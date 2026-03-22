const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth gate: require JWT + authenticated user, or internal secret
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    const isInternalCall = !!expectedSecret && internalSecret === expectedSecret;

    if (!isInternalCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const targetView = body.view || "upisnik-predmeta"; // default to upisnik
    const targetTab = body.tab; // optional: which tab to click (e.g. "0", "1", "2")

    const SDGE_USERNAME = Deno.env.get("SDGE_USERNAME")!;
    const SDGE_PASSWORD = Deno.env.get("SDGE_PASSWORD")!;
    if (!SDGE_USERNAME || !SDGE_PASSWORD) throw new Error("SDGE credentials not configured");

    const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const cookieJar: Map<string, string> = new Map();
    const collectCookies = (r: Response) => {
      for (const [k, v] of r.headers.entries()) {
        if (k.toLowerCase() === "set-cookie") { const cp = v.split(";")[0]; const [n] = cp.split("="); cookieJar.set(n.trim(), cp); }
      }
    };
    const getCookies = () => Array.from(cookieJar.values()).join("; ");

    // LOGIN
    const lp = await fetch("https://sdge.dgu.hr/login", { headers: { "User-Agent": UA }, redirect: "follow" });
    await lp.text(); collectCookies(lp);
    const form = new URLSearchParams(); form.append("username", SDGE_USERNAME); form.append("password", SDGE_PASSWORD);
    const lr = await fetch("https://sdge.dgu.hr/j_spring_security_check", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, "Cookie": getCookies(), "Referer": "https://sdge.dgu.hr/login" },
      body: form.toString(), redirect: "manual",
    });
    collectCookies(lr);
    const loc = lr.headers.get("location");
    if (loc?.includes("error")) throw new Error("Login failed");
    if (loc) {
      const u = loc.startsWith("http") ? loc : `https://sdge.dgu.hr${loc}`;
      const r = await fetch(u, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" }); collectCookies(r);
      const l2 = r.headers.get("location");
      if (l2) { const u2 = l2.startsWith("http") ? l2 : `https://sdge.dgu.hr${l2}`; await fetch(u2, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" }).then(r2 => collectCookies(r2)); }
    }
    const ar = await fetch("https://sdge.dgu.hr/app", { headers: { "Cookie": getCookies(), "User-Agent": UA }, redirect: "follow" });
    collectCookies(ar); const html = await ar.text();
    if (html.includes("<title>Prijava</title>")) throw new Error("Not logged in");
    const m = html.match(/vaadin\.initApplication\("([^"]+)"/);
    const vaadinAppId = m ? m[1] : "app-96801";

    // INIT — navigate to the target view
    const now = Date.now();
    const ip = new URLSearchParams();
    ip.append("v-browserDetails", "1"); ip.append("theme", "custom"); ip.append("v-appId", vaadinAppId);
    ip.append("v-sh", "1080"); ip.append("v-sw", "1920"); ip.append("v-cw", "1920"); ip.append("v-ch", "1080");
    ip.append("v-curdate", String(now)); ip.append("v-tzo", "-60"); ip.append("v-dstd", "60");
    ip.append("v-rtl", "false"); ip.append("v-dpr", "1");
    ip.append("v-loc", `https://sdge.dgu.hr/app#!${targetView}`);
    ip.append("v-wn", vaadinAppId);

    const ir = await fetch(`https://sdge.dgu.hr/app/?v-${now}`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": getCookies(), "User-Agent": UA },
      body: ip.toString(),
    });
    collectCookies(ir);
    const raw = await ir.text();
    const outer = JSON.parse(raw);
    const uiId = String(outer["v-uiId"] ?? "0");
    const uidl = typeof outer.uidl === "string" ? JSON.parse(outer.uidl) : outer.uidl;
    const csrf = uidl["Vaadin-Security-Key"] || "";
    let currentSyncId = uidl.syncId ?? 0;
    let clientId = 0;
    console.log("Init: uiId=", uiId, "syncId=", currentSyncId, "view=", targetView);

    // Build type maps from init response
    const typeMap: Record<string, string> = {};
    const typeNames: Record<string, string> = {};
    if (uidl?.typeMappings) {
      for (const [connId, typeNum] of Object.entries(uidl.typeMappings)) {
        typeMap[connId] = String(typeNum);
      }
    }
    const allTypeInheritance = uidl?.typeInheritanceMap || {};
    for (const [typeNum, parents] of Object.entries(allTypeInheritance)) {
      if (Array.isArray(parents) && parents.length > 0) {
        typeNames[typeNum] = String(parents[0]);
      }
    }

    // Log ALL state from init — find tabs, grids, forms, buttons
    const initComponents: Record<string, any> = {};
    const tabSheets: Record<string, any> = {};
    const grids: Record<string, any> = {};
    const buttons: Record<string, any> = {};
    const textFields: Record<string, any> = {};

    if (uidl?.state) {
      for (const [pid, st] of Object.entries(uidl.state)) {
        const s = st as any;
        const typeNum = typeMap[pid];
        const typeName = typeNum ? (typeNames[typeNum] || typeNum) : "unknown";

        // Categorize components
        if (s.tabs !== undefined) {
          tabSheets[pid] = { type: typeName, tabs: s.tabs };
          console.log(`TABSHEET[${pid}]: ${JSON.stringify(s.tabs).substring(0, 500)}`);
        }
        if (typeName.includes("Grid") || s.columns !== undefined) {
          grids[pid] = { type: typeName, columns: s.columns };
          console.log(`GRID[${pid}]: cols=${JSON.stringify(s.columns || []).substring(0, 500)}`);
        }
        if (typeName.includes("Button") && s.caption) {
          buttons[pid] = { type: typeName, caption: s.caption };
          console.log(`BUTTON[${pid}]: ${s.caption}`);
        }
        if (typeName.includes("TextField") || typeName.includes("ComboBox") || typeName.includes("DateField")) {
          textFields[pid] = { type: typeName, caption: s.caption, inputPrompt: s.inputPrompt, text: s.text };
          console.log(`INPUT[${pid}] type=${typeName}: caption=${s.caption}, prompt=${s.inputPrompt}`);
        }

        // Log anything with caption/text for general discovery
        if (s.caption || s.text || s.inputPrompt) {
          initComponents[pid] = { type: typeName, caption: s.caption, text: s.text, inputPrompt: s.inputPrompt };
        }
      }
    }

    // Log hierarchy from changes
    let hierarchyInfo: any[] = [];
    if (uidl?.changes) {
      const changes = uidl.changes;
      // changes is typically an array of arrays: [parentId, childId1, childId2, ...]
      if (Array.isArray(changes)) {
        for (const change of changes) {
          if (Array.isArray(change) && change.length >= 2) {
            hierarchyInfo.push(change);
          }
        }
      }
      const cStr = JSON.stringify(changes);
      // Log changes in chunks
      for (let i = 0; i < Math.min(cStr.length, 12000); i += 2000) {
        console.log(`INIT_CHANGES[${i}]:`, cStr.substring(i, i + 2000));
      }
    }

    // If a specific tab was requested, click it
    let tabResponse: any = null;
    if (targetTab !== undefined) {
      // Find the first TabSheet
      const tabSheetIds = Object.keys(tabSheets);
      const tabSheetId = tabSheetIds.length > 0 ? tabSheetIds[0] : "159";
      
      console.log(`Clicking tab ${targetTab} on TabSheet ${tabSheetId}...`);
      const tabPayload = {
        csrfToken: csrf,
        rpc: [[tabSheetId, "com.vaadin.shared.ui.tabsheet.TabsheetServerRpc", "setSelected", [targetTab]]],
        syncId: currentSyncId,
        clientId: clientId++,
      };

      const tabResp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8", "Cookie": getCookies(), "User-Agent": UA },
        body: JSON.stringify(tabPayload),
      });
      const tabText = await tabResp.text();
      const cleanTab = tabText.replace(/^for\s*\(;;\)\s*;\s*/, "");
      tabResponse = JSON.parse(cleanTab);
      const tabData = Array.isArray(tabResponse) ? tabResponse[0] : tabResponse;
      
      if (tabData?.syncId !== undefined) currentSyncId = tabData.syncId;

      // Update type maps
      if (tabData?.typeMappings) {
        for (const [connId, typeNum] of Object.entries(tabData.typeMappings)) {
          typeMap[connId] = String(typeNum);
        }
      }
      if (tabData?.typeInheritanceMap) {
        for (const [typeNum, parents] of Object.entries(tabData.typeInheritanceMap)) {
          if (Array.isArray(parents) && parents.length > 0) {
            typeNames[typeNum] = String(parents[0]);
          }
        }
      }

      // Log new state after tab click
      if (tabData?.state) {
        for (const [pid, st] of Object.entries(tabData.state)) {
          const s = st as any;
          const typeNum = typeMap[pid];
          const typeName = typeNum ? (typeNames[typeNum] || typeNum) : "unknown";
          
          if (s.tabs !== undefined) {
            console.log(`TAB_RESP TABSHEET[${pid}]: ${JSON.stringify(s.tabs).substring(0, 500)}`);
          }
          if (s.columns !== undefined) {
            console.log(`TAB_RESP GRID[${pid}]: ${JSON.stringify(s.columns).substring(0, 500)}`);
          }
          if (s.caption || s.text || s.inputPrompt) {
            console.log(`TAB_RESP[${pid}] type=${typeName}: caption=${s.caption}, text=${s.text}, prompt=${s.inputPrompt}`);
          }
        }
      }
      if (tabData?.changes) {
        const tcStr = JSON.stringify(tabData.changes);
        for (let i = 0; i < Math.min(tcStr.length, 12000); i += 2000) {
          console.log(`TAB_CHANGES[${i}]:`, tcStr.substring(i, i + 2000));
        }
      }
    }

    // Also try a Vaadin navigation RPC to the view
    console.log(`Navigating via Vaadin to: ${targetView}`);
    const navPayload = {
      csrfToken: csrf,
      rpc: [[uiId, "com.vaadin.shared.ui.ui.UIServerRpc", "fragmentChanged", [`!${targetView}`]]],
      syncId: currentSyncId,
      clientId: clientId++,
    };
    const navResp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8", "Cookie": getCookies(), "User-Agent": UA },
      body: JSON.stringify(navPayload),
    });
    const navText = await navResp.text();
    const cleanNav = navText.replace(/^for\s*\(;;\)\s*;\s*/, "");
    const navData = JSON.parse(cleanNav);
    const navPayloadData = Array.isArray(navData) ? navData[0] : navData;

    if (navPayloadData?.syncId !== undefined) currentSyncId = navPayloadData.syncId;

    // Log nav response
    console.log("Nav response keys:", Object.keys(navPayloadData).join(", "));
    if (navPayloadData?.state) {
      for (const [pid, st] of Object.entries(navPayloadData.state)) {
        const s = st as any;
        const typeNum = typeMap[pid] || (navPayloadData.typeMappings?.[pid] ? String(navPayloadData.typeMappings[pid]) : undefined);
        let typeName = "unknown";
        if (typeNum) {
          const navTypeNames = navPayloadData.typeInheritanceMap || {};
          const parents = navTypeNames[typeNum];
          typeName = (Array.isArray(parents) && parents.length > 0) ? String(parents[0]) : typeNames[typeNum] || typeNum;
        }

        if (s.caption || s.text || s.inputPrompt || s.tabs || s.columns) {
          console.log(`NAV[${pid}] type=${typeName}: ${JSON.stringify(s).substring(0, 500)}`);
        }
      }
    }
    if (navPayloadData?.changes) {
      const ncStr = JSON.stringify(navPayloadData.changes);
      for (let i = 0; i < Math.min(ncStr.length, 12000); i += 2000) {
        console.log(`NAV_CHANGES[${i}]:`, ncStr.substring(i, i + 2000));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      target_view: targetView,
      target_tab: targetTab,
      ui_id: uiId,
      sync_id: currentSyncId,
      init_components: Object.keys(initComponents).length,
      tab_sheets: Object.keys(tabSheets),
      grids: Object.keys(grids),
      buttons: Object.keys(buttons),
      text_fields: Object.keys(textFields),
      component_details: initComponents,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
