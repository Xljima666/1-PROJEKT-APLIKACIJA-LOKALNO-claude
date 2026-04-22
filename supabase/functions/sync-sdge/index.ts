import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SdgeEvent {
  title: string;
  date: string;
  type: "terenski_uvidaj" | "zakljucak" | "predocavanje" | "ostalo";
  rawId: string;
}

const normalizeForKey = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const sha256Hex = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const buildStableSdgeId = async (event: SdgeEvent) => {
  const stableKey = `${event.type}|${event.date}|${normalizeForKey(event.title)}`;
  const digest = await sha256Hex(stableKey);
  return `vaadin-${event.type}-${event.date}-${digest.slice(0, 24)}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SDGE_USERNAME = Deno.env.get("SDGE_USERNAME");
    const SDGE_PASSWORD = Deno.env.get("SDGE_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SDGE_USERNAME || !SDGE_PASSWORD) {
      return new Response(JSON.stringify({ error: "SDGE credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    const internalSecret = req.headers.get("x-internal-secret");
    const authHeader = req.headers.get("Authorization");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const isInternalCall = !!CRON_SECRET && internalSecret === CRON_SECRET;

    if (internalSecret && !isInternalCall) {
      return new Response(JSON.stringify({ error: "Invalid secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let userId: string | null = null;

    // Always resolve user_id server-side from admin role — never accept from client
    if (isInternalCall) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();
      userId = adminRole?.user_id || null;
    } else {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "No admin user found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const cookieJar: Map<string, string> = new Map();
    const collectCookies = (r: Response) => {
      for (const [k, v] of r.headers.entries()) {
        if (k.toLowerCase() === "set-cookie") {
          const cp = v.split(";")[0]; const [n] = cp.split("=");
          cookieJar.set(n.trim(), cp);
        }
      }
    };
    const getCookies = () => Array.from(cookieJar.values()).join("; ");

    // STEP 1: Get login page for cookies
    console.log("Step 1: Getting login page...");
    const loginPage = await fetch("https://sdge.dgu.hr/login", {
      headers: { "User-Agent": UA }, redirect: "follow",
    });
    await loginPage.text();
    collectCookies(loginPage);

    // STEP 2: Login
    console.log("Step 2: Logging in...");
    const loginForm = new URLSearchParams();
    loginForm.append("username", SDGE_USERNAME);
    loginForm.append("password", SDGE_PASSWORD);

    const loginResp = await fetch("https://sdge.dgu.hr/j_spring_security_check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA, "Cookie": getCookies(), "Referer": "https://sdge.dgu.hr/login",
      },
      body: loginForm.toString(),
      redirect: "manual",
    });
    collectCookies(loginResp);
    const loginStatus = loginResp.status;
    const loginLocation = loginResp.headers.get("location");
    console.log("Login:", loginStatus, "->", loginLocation);

    if (loginLocation?.includes("error") || loginStatus === 200) {
      return new Response(JSON.stringify({ error: "SDGE login failed", login_status: loginStatus }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Follow redirects
    if (loginLocation) {
      const url = loginLocation.startsWith("http") ? loginLocation : `https://sdge.dgu.hr${loginLocation}`;
      const r = await fetch(url, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" });
      collectCookies(r);
      const r2loc = r.headers.get("location");
      if (r2loc) {
        const u2 = r2loc.startsWith("http") ? r2loc : `https://sdge.dgu.hr${r2loc}`;
        const r2 = await fetch(u2, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" });
        collectCookies(r2);
      }
    }

    // STEP 3: Load app page
    console.log("Step 3: Loading app...");
    const appResp = await fetch("https://sdge.dgu.hr/app", {
      headers: { "Cookie": getCookies(), "User-Agent": UA }, redirect: "follow",
    });
    collectCookies(appResp);
    const appHtml = await appResp.text();

    if (appHtml.includes("<title>Prijava</title>")) {
      return new Response(JSON.stringify({ error: "Not logged in" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const appIdMatch = appHtml.match(/vaadin\.initApplication\("([^"]+)"/);
    const vaadinAppId = appIdMatch ? appIdMatch[1] : "app-96801";

    // STEP 4: Vaadin init with #!kalendar location
    console.log("Step 4: Vaadin init...");
    const now = Date.now();
    const initParams = new URLSearchParams();
    initParams.append("v-browserDetails", "1");
    initParams.append("theme", "custom");
    initParams.append("v-appId", vaadinAppId);
    initParams.append("v-sh", "1080");
    initParams.append("v-sw", "1920");
    initParams.append("v-cw", "1920");
    initParams.append("v-ch", "1080");
    initParams.append("v-curdate", String(now));
    initParams.append("v-tzo", "-60");
    initParams.append("v-dstd", "60");
    initParams.append("v-rtl", "false");
    initParams.append("v-dpr", "1");
    initParams.append("v-loc", "https://sdge.dgu.hr/app#!kalendar");
    initParams.append("v-wn", vaadinAppId);

    const initResp = await fetch(`https://sdge.dgu.hr/app/?v-${now}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": getCookies(), "User-Agent": UA,
      },
      body: initParams.toString(),
    });
    collectCookies(initResp);
    const initRaw = await initResp.text();
    console.log("Init status:", initResp.status, "len:", initRaw.length);

    // Parse the response: it's JSON with {v-uiId: N, uidl: "JSON_STRING"}
    let outerData: any = null;
    let uidlData: any = null;
    let csrfToken = "";
    let syncId = 0;
    let uiId = "0";

    try {
      outerData = JSON.parse(initRaw);
      uiId = String(outerData["v-uiId"] ?? "0");
      
      // uidl is a JSON string that needs second parse
      const uidlStr = outerData.uidl;
      if (typeof uidlStr === "string") {
        uidlData = JSON.parse(uidlStr);
      } else {
        uidlData = uidlStr;
      }

      csrfToken = uidlData["Vaadin-Security-Key"] || "";
      syncId = uidlData.syncId ?? 0;
      console.log("uiId:", uiId, "csrf:", csrfToken ? "yes" : "no", "syncId:", syncId);
      console.log("UIDL top keys:", Object.keys(uidlData).join(", "));
    } catch (e) {
      console.log("Parse error:", e);
      console.log("Raw preview:", initRaw.substring(0, 500));
    }

    // Log UIDL changes for analysis
    if (uidlData) {
      const changesStr = JSON.stringify(uidlData.changes);
      // Log in chunks
      for (let i = 0; i < Math.min(changesStr.length, 20000); i += 2000) {
        console.log(`=== changes ${i}-${i+2000} ===`);
        console.log(changesStr.substring(i, i + 2000));
      }
      
      // Log state
      const stateStr = JSON.stringify(uidlData.state);
      for (let i = 0; i < Math.min(stateStr.length, 20000); i += 2000) {
        console.log(`=== state ${i}-${i+2000} ===`);
        console.log(stateStr.substring(i, i + 2000));
      }
    }

    // STEP 5: Request calendar events via UIDL
    // The init response sets up the UI but might not include event data yet.
    // We need to look for a Calendar component and its events in the state/changes.
    console.log("Step 5: Looking for calendar data...");

    const events: SdgeEvent[] = [];
    
    // Search for events in the UIDL data
    const searchForCalendarData = (obj: any, path: string = "", depth: number = 0) => {
      if (!obj || typeof obj !== "object" || depth > 25) return;

      if (Array.isArray(obj)) {
        obj.forEach((item, i) => searchForCalendarData(item, `${path}[${i}]`, depth + 1));
        return;
      }

      const keys = Object.keys(obj);

      // Look for Vaadin calendar event properties (captions with dates)
      if (obj.caption && (obj.dateFrom || obj.dateTo || obj.start || obj.allDay !== undefined)) {
        console.log("CALENDAR EVENT at", path, ":", JSON.stringify(obj).substring(0, 300));
        extractVaadinCalendarEvent(obj);
      }

      // Look for Vaadin Calendar component state with events
      if (obj.events && Array.isArray(obj.events)) {
        console.log("Events array at", path, "count:", obj.events.length);
        for (const ev of obj.events) extractVaadinCalendarEvent(ev);
      }

      // Look for table/grid rows
      if (obj.rows && Array.isArray(obj.rows)) {
        console.log("Rows at", path, "count:", obj.rows.length);
        for (const row of obj.rows) {
          if (Array.isArray(row)) {
            // Vaadin grid rows are arrays of cell values
            console.log("Row data:", JSON.stringify(row).substring(0, 200));
          }
        }
      }

      for (const key of keys) {
        searchForCalendarData(obj[key], `${path}.${key}`, depth + 1);
      }
    };

    const extractVaadinCalendarEvent = (ev: any) => {
      if (!ev || typeof ev !== "object") return;
      
      const caption = ev.caption || ev.title || ev.description || ev.styleName || "";
      const dateFrom = ev.dateFrom || ev.start || ev.date || "";
      const dateTo = ev.dateTo || ev.end || "";
      const styleName = ev.styleName || ev.style || "";
      const allDay = ev.allDay ?? true;

      if (!caption && !dateFrom) return;

      const captionLower = String(caption).toLowerCase();
      const styleNameLower = String(styleName).toLowerCase();
      
      let eventType: SdgeEvent["type"] = "ostalo";
      if (captionLower.includes("zaklju") || styleNameLower.includes("zaklju")) eventType = "zakljucak";
      else if (captionLower.includes("teren") || styleNameLower.includes("teren")) eventType = "terenski_uvidaj";
      else if (captionLower.includes("predo") || styleNameLower.includes("predo")) eventType = "predocavanje";

      let parsedDate = "";
      if (dateFrom) {
        try {
          const d = new Date(dateFrom);
          if (!isNaN(d.getTime())) parsedDate = d.toISOString().split("T")[0];
          else parsedDate = String(dateFrom);
        } catch { parsedDate = String(dateFrom); }
      }

      const rawId = String(ev.index ?? ev.id ?? ev.key ?? Math.random());
      
      if (parsedDate) {
        events.push({
          title: String(caption),
          date: parsedDate,
          type: eventType,
          rawId,
        });
      }
    };

    if (uidlData) {
      searchForCalendarData(uidlData, "uidl");
    }

    // If no events found in init, try a UIDL poll to get calendar data
    if (events.length === 0 && csrfToken && syncId >= 0) {
      console.log("No events in init, trying UIDL poll...");
      const pollPayload = {
        csrfToken,
        rpc: [[uiId, "com.vaadin.shared.ui.ui.UIServerRpc", "poll", []]],
        syncId: syncId + 1,
        clientId: 0,
      };

      const pollResp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cookie": getCookies(), "User-Agent": UA,
        },
        body: JSON.stringify(pollPayload),
      });
      const pollText = await pollResp.text();
      try {
        const cleanPoll = pollText.replace(/^for\s*\(;;\)\s*;\s*/, "");
        const pollData = JSON.parse(cleanPoll);
        searchForCalendarData(pollData, "poll");
        if (pollData.syncId !== undefined) syncId = pollData.syncId;
      } catch (e) {
        console.log("Poll parse error:", e);
      }
    }

    const currentMonthEvents = events.length;
    console.log("Current month events:", currentMonthEvents);

    // STEP 6: Navigate to NEXT month via CalendarServerRpc.forward()
    // Calendar component ID is 261 (found from state.261.events)
    // Find the calendar connector ID from the changes/state
    let calendarConnectorId = "261"; // Default from observed data
    if (uidlData?.state) {
      for (const pid of Object.keys(uidlData.state)) {
        if (uidlData.state[pid]?.events && Array.isArray(uidlData.state[pid].events)) {
          calendarConnectorId = pid;
          break;
        }
      }
    }

    // Navigate forward multiple times to cover current month + next months
    // SDGE calendar may start on a previous month, so we forward several times
    if (csrfToken) {
      let clientId = 0;
      let currentSyncId = syncId >= 0 ? syncId : 0;
      const forwardSteps = 4;
      
      for (let step = 0; step < forwardSteps; step++) {
        console.log(`Step 6.${step + 1}: Forward #${step + 1} (syncId: ${currentSyncId}, clientId: ${clientId})...`);
        
        const forwardPayload: any = {
          csrfToken,
          rpc: [[calendarConnectorId, "com.vaadin.shared.ui.calendar.CalendarServerRpc", "forward", []]],
          syncId: currentSyncId,
          clientId: clientId++,
        };
        // First request after init must acknowledge resynchronize
        if (step === 0) {
          forwardPayload.resynchronize = true;
        }

        const fwdResp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Cookie": getCookies(), "User-Agent": UA,
          },
          body: JSON.stringify(forwardPayload),
        });
        const fwdText = await fwdResp.text();
        console.log(`Forward #${step + 1} status:`, fwdResp.status, "len:", fwdText.length);

        try {
          const cleanFwd = fwdText.replace(/^for\s*\(;;\)\s*;\s*/, "");
          let fwdData = JSON.parse(cleanFwd);
          
          // UIDL responses after init are wrapped in array: [{syncId, state, changes, ...}]
          const fwdPayload = Array.isArray(fwdData) ? fwdData[0] : fwdData;
          
          // Search entire response for calendar data
          searchForCalendarData(fwdData, `fwd${step + 1}`);
          
          // Update syncId from server response for next iteration
          if (fwdPayload?.syncId !== undefined) {
            currentSyncId = fwdPayload.syncId;
            console.log(`Forward #${step + 1} server syncId: ${currentSyncId}`);
          }
          
          // Log some event dates for debugging
          if (fwdPayload?.state) {
            for (const pid of Object.keys(fwdPayload.state)) {
              const st = fwdPayload.state[pid];
              if (st?.events && Array.isArray(st.events) && st.events.length > 0) {
                const dates = st.events.map((e: any) => e.dateFrom).filter(Boolean);
                console.log(`Forward #${step + 1} calendar ${pid}: ${st.events.length} events, dates: ${dates.slice(0, 3).join(", ")}...`);
              }
            }
          }
          
          const stepEvents = events.length;
          console.log(`Forward #${step + 1} total events so far: ${stepEvents}`);
        } catch (e) {
          console.log(`Forward #${step + 1} parse error:`, e);
          break;
        }
      }
    }

    const nextMonthEvents = events.length - currentMonthEvents;
    console.log("Next month events:", nextMonthEvents);
    console.log("Total events found:", events.length);

    // STEP 6: Save to DB
    let newEventsCreated = 0;
    let saveErrors = 0;
    let skippedExisting = 0;
    let skippedInRun = 0;
    const savedEventDates: string[] = [];
    const seenSdgeIds = new Set<string>();
    const foundEventDates = Array.from(new Set(
      events
        .filter((event) => event.type !== "ostalo")
        .map((event) => event.date)
    )).sort();

    for (const event of events) {
      if (event.type === "ostalo") continue; // Only sync terenski and zakljucak
      
      const sdgeId = await buildStableSdgeId(event);
      const description = `[SDGE] ${event.type === "terenski_uvidaj" ? "Terenski uviđaj" : "Zaključak"}`;
      if (seenSdgeIds.has(sdgeId)) {
        skippedInRun++;
        continue;
      }
      seenSdgeIds.add(sdgeId);

      const { data: existing, error: existingError } = await supabase
        .from("sdge_notifications").select("id").eq("sdge_id", sdgeId).limit(1);
      if (existingError) {
        console.error("SDGE duplicate check failed:", existingError);
        saveErrors++;
        continue;
      }
      if (existing && existing.length > 0) {
        skippedExisting++;
        continue;
      }

      const { data: existingCalendar, error: existingCalendarError } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_date", event.date)
        .eq("title", event.title)
        .eq("description", description)
        .limit(1);
      if (existingCalendarError) {
        console.error("SDGE calendar duplicate check failed:", existingCalendarError);
        saveErrors++;
        continue;
      }
      if (existingCalendar && existingCalendar.length > 0) {
        const { error: notificationError } = await supabase.from("sdge_notifications").upsert({
          sdge_id: sdgeId, title: event.title,
          description: event.type === "terenski_uvidaj" ? "Terenski uviđaj" : "Zaključak",
          event_type: event.type, event_date: event.date,
          raw_data: { rawId: event.rawId, stableKey: true },
          synced_to_calendar: true, calendar_event_id: existingCalendar[0].id, user_id: userId,
        }, { onConflict: "sdge_id" });
        if (notificationError) {
          console.error("SDGE notification upsert for existing calendar event failed:", notificationError);
          saveErrors++;
        }
        skippedExisting++;
        continue;
      }

      const color = event.type === "terenski_uvidaj" ? "#F97316" : "#22C55E";
      const { data: calEvent, error: calendarError } = await supabase.from("calendar_events").insert({
        title: event.title,
        description,
        event_date: event.date, color, user_id: userId, all_day: true,
      }).select("id").single();

      if (calendarError) {
        console.error("SDGE calendar insert failed:", calendarError);
        saveErrors++;
        continue;
      }

      const { error: notificationError } = await supabase.from("sdge_notifications").insert({
        sdge_id: sdgeId, title: event.title,
        description: event.type === "terenski_uvidaj" ? "Terenski uviđaj" : "Zaključak",
        event_type: event.type, event_date: event.date,
        raw_data: { rawId: event.rawId, stableKey: true },
        synced_to_calendar: !!calEvent, calendar_event_id: calEvent?.id || null, user_id: userId,
      });
      if (notificationError) {
        console.error("SDGE notification insert failed:", notificationError);
        saveErrors++;
      }
      if (calEvent) {
        newEventsCreated++;
        savedEventDates.push(event.date);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      login_ok: loginStatus === 302,
      vaadin_ui_id: uiId,
      has_csrf: !!csrfToken,
      current_month_events: currentMonthEvents,
      next_month_events: nextMonthEvents,
      events_found: events.length,
      new_events_created: newEventsCreated,
      skipped_existing: skippedExisting,
      skipped_in_run: skippedInRun,
      save_errors: saveErrors,
      found_event_dates: foundEventDates,
      saved_event_dates: savedEventDates,
      message: events.length > 0
        ? `Sync gotov. ${newEventsCreated} novih događaja (${currentMonthEvents} ovaj mjesec, ${nextMonthEvents} sljedeći).`
        : "Sync završen - pogledaj logove.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("SDGE sync error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
