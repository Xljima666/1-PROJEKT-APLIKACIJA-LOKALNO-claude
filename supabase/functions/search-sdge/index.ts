const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COLUMN_MAP: Record<string, string> = {
  "1": "broj_predmeta", "2": "datum_izrade", "3": "datum_osnivanja",
  "4": "datum_statusa", "5": "izradio", "6": "interni_broj",
  "7": "lokacija", "8": "narucitelj", "9": "kat_opcina",
  "10": "naselje", "11": "naziv_predmeta", "12": "status", "13": "sl_duznost",
};

async function sdgeLogin() {
  const SDGE_USERNAME = Deno.env.get("SDGE_USERNAME")!;
  const SDGE_PASSWORD = Deno.env.get("SDGE_PASSWORD")!;
  if (!SDGE_USERNAME || !SDGE_PASSWORD) throw new Error("SDGE credentials not configured");

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
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

  const lp = await fetch("https://sdge.dgu.hr/login", { headers: { "User-Agent": UA }, redirect: "follow" });
  await lp.text(); collectCookies(lp);

  const form = new URLSearchParams();
  form.append("username", SDGE_USERNAME);
  form.append("password", SDGE_PASSWORD);
  const lr = await fetch("https://sdge.dgu.hr/j_spring_security_check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA, "Cookie": getCookies(), "Referer": "https://sdge.dgu.hr/login" },
    body: form.toString(), redirect: "manual",
  });
  collectCookies(lr);
  const loc = lr.headers.get("location");
  if (loc?.includes("error")) throw new Error("SDGE login failed");
  if (loc) {
    const u = loc.startsWith("http") ? loc : `https://sdge.dgu.hr${loc}`;
    const r = await fetch(u, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" }); collectCookies(r);
    const l2 = r.headers.get("location");
    if (l2) {
      const u2 = l2.startsWith("http") ? l2 : `https://sdge.dgu.hr${l2}`;
      await fetch(u2, { headers: { "User-Agent": UA, "Cookie": getCookies() }, redirect: "manual" }).then(r2 => collectCookies(r2));
    }
  }
  const ar = await fetch("https://sdge.dgu.hr/app", { headers: { "Cookie": getCookies(), "User-Agent": UA }, redirect: "follow" });
  collectCookies(ar); const html = await ar.text();
  if (html.includes("<title>Prijava</title>")) throw new Error("Not logged in");
  const m = html.match(/vaadin\.initApplication\("([^"]+)"/);
  const vaadinAppId = m ? m[1] : "app-96801";
  return { getCookies, collectCookies, UA, vaadinAppId };
}

async function vaadinRpc(
  uiId: string, getCookies: () => string, UA: string,
  csrf: string, syncId: number, clientId: number,
  rpcCalls: any[], collectCookies?: (r: Response) => void,
  extra: Record<string, any> = {}
) {
  const payload: any = { csrfToken: csrf, rpc: rpcCalls, syncId, clientId, ...extra };
  const resp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cookie": getCookies(), "User-Agent": UA },
    body: JSON.stringify(payload),
  });
  if (collectCookies) collectCookies(resp);
  const text = await resp.text();
  const clean = text.replace(/^for\s*\(;;\)\s*;\s*/, "");
  return JSON.parse(clean);
}

function parseRow(obj: any): Record<string, string> | null {
  if (!obj || typeof obj !== "object" || obj.k === undefined || !obj.d) return null;
  const row: Record<string, string> = { _key: String(obj.k) };
  for (const [colId, value] of Object.entries(obj.d)) {
    const colName = COLUMN_MAP[colId] || `col_${colId}`;
    let strVal = String(value);
    if (strVal.includes("<")) strVal = strVal.replace(/<[^>]*>/g, "").trim();
    row[colName] = strVal;
  }
  return row;
}

function extractAllRows(data: any): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  const seen = new Set<string>();
  const search = (obj: any, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 30) return;
    if (Array.isArray(obj)) {
      for (const item of obj) search(item, depth + 1);
      return;
    }
    const row = parseRow(obj);
    if (row && !seen.has(row._key)) {
      seen.add(row._key);
      results.push(row);
    }
    for (const key of Object.keys(obj)) {
      search(obj[key], depth + 1);
    }
  };
  search(data);
  return results;
}

function matchesFilter(row: Record<string, string>, filters: Record<string, string>): boolean {
  const activeFilters = Object.entries(filters).filter(([, v]) => !!v);
  if (activeFilters.length === 0) return true;
  
  // If only one filter, must match that one
  if (activeFilters.length === 1) {
    const [field, value] = activeFilters[0];
    const rowVal = (row[field] || "").toLowerCase();
    return rowVal.includes(value.toLowerCase());
  }
  
  // Multiple filters: require at least one match, but prioritize rows matching more filters
  // For strict mode: match ALL. But to avoid 0 results, fall back to ANY match
  let matchCount = 0;
  for (const [field, value] of activeFilters) {
    const rowVal = (row[field] || "").toLowerCase();
    if (rowVal.includes(value.toLowerCase())) matchCount++;
  }
  // Must match at least one filter (relaxed matching)
  return matchCount > 0;
}

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
    const { naziv, godina, status, kat_opcina, interni_broj, izradio, max_pages } = body;
    const pagesToFetch = Math.min(max_pages || 5, 31); // Default: 5 pages, max 31
    console.log("Search params:", JSON.stringify({ naziv, godina, status, kat_opcina, interni_broj, izradio, pagesToFetch }));

    // Step 1: Login + Init
    const { getCookies, collectCookies, UA, vaadinAppId } = await sdgeLogin();
    console.log("Login OK");

    const now = Date.now();
    const ip = new URLSearchParams();
    ip.append("v-browserDetails", "1"); ip.append("theme", "custom"); ip.append("v-appId", vaadinAppId);
    ip.append("v-sh", "1080"); ip.append("v-sw", "1920"); ip.append("v-cw", "1920"); ip.append("v-ch", "1080");
    ip.append("v-curdate", String(now)); ip.append("v-tzo", "-60"); ip.append("v-dstd", "60");
    ip.append("v-rtl", "false"); ip.append("v-dpr", "1");
    ip.append("v-loc", "https://sdge.dgu.hr/app#!pretraga-predmeta");
    ip.append("v-wn", vaadinAppId);

    const ir = await fetch(`https://sdge.dgu.hr/app/?v-${now}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": getCookies(), "User-Agent": UA },
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
    console.log("Init OK");

    // Extract rows from init response (page 1 - 12 rows)
    const allRows = extractAllRows(uidl);
    console.log("Page 1 rows:", allRows.length);

    // Extract total count from pager
    let totalRecords = 0;
    if (uidl?.state) {
      for (const st of Object.values(uidl.state)) {
        const s = st as any;
        if (s?.text && typeof s.text === "string" && s.text.includes("od ")) {
          const match = s.text.match(/od (\d+)/);
          if (match) totalRecords = parseInt(match[1]);
        }
      }
    }
    console.log("Total records:", totalRecords);

    // Pager buttons: 191=First, 192=Prev, 199=Next, 200=Last
    const nextButtonId = "199";
    const totalPages = Math.ceil(totalRecords / 12);
    const pagesToGet = Math.min(pagesToFetch, totalPages);

    // Deduplicate helper
    const seenKeys = new Set<string>();
    for (const r of allRows) if (r._key) seenKeys.add(r._key);

    // Data provider connector ID (from Grid's DataCommunicator)
    const dataProviderConnId = "175";

    for (let page = 2; page <= pagesToGet; page++) {
      console.log(`Fetching page ${page}/${pagesToGet}...`);
      try {
        // Step 1: Click Next button to advance page
        const pageResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
          [nextButtonId, "com.vaadin.shared.ui.button.ButtonServerRpc", "click", [
            { altKey: false, button: "LEFT", clientX: 500, clientY: 400, ctrlKey: false, metaKey: false, relativeX: 10, relativeY: 10, shiftKey: false, type: 1 }
          ]]
        ], collectCookies);
        const pd = Array.isArray(pageResult) ? pageResult[0] : pageResult;
        if (pd?.syncId !== undefined) currentSyncId = pd.syncId;

        // Step 2: Request actual row data (Vaadin lazy loading)
        const dataResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
          [dataProviderConnId, "com.vaadin.shared.data.DataRequestRpc", "requestRows", [0, 12, 0, 0]]
        ], collectCookies);
        const dd = Array.isArray(dataResult) ? dataResult[0] : dataResult;
        if (dd?.syncId !== undefined) currentSyncId = dd.syncId;

        const pageRows = extractAllRows(dd);
        let newCount = 0;
        for (const row of pageRows) {
          if (row._key && !seenKeys.has(row._key)) {
            seenKeys.add(row._key);
            allRows.push(row);
            newCount++;
          }
        }
        console.log(`Page ${page}: ${pageRows.length} extracted, ${newCount} new (total: ${allRows.length})`);

        if (newCount === 0) {
          console.log("No new rows on page " + page + ", stopping");
          break;
        }
        if (allRows.length >= totalRecords) break;
      } catch (e) {
        console.error(`Page ${page} error:`, e);
        break;
      }
    }

    console.log("Total rows fetched:", allRows.length);

    // Apply filters — also search naziv across multiple columns for broader matching
    const filters: Record<string, string> = {};
    if (naziv) filters.naziv_predmeta = naziv;
    if (godina) {
      // Filter by year in datum_izrade or broj_predmeta (e.g. "10/2026")
      filters.broj_predmeta = `/${godina}`;
    }
    if (status) filters.status = status.replace(/_/g, " ").toUpperCase();
    if (kat_opcina) filters.kat_opcina = kat_opcina;
    if (interni_broj) filters.interni_broj = interni_broj;
    if (izradio) filters.izradio = izradio;
    
    // Also try matching naziv across all text fields (broader search)
    const hasFilters = Object.values(filters).some(v => !!v);
    let filtered = hasFilters
      ? allRows.filter(row => matchesFilter(row, filters))
      : allRows;
    
    // If strict filtering returned 0 results and we have naziv, try searching naziv across ALL columns
    if (filtered.length === 0 && naziv) {
      const searchTerm = naziv.toLowerCase();
      filtered = allRows.filter(row => {
        return Object.values(row).some(val => val.toLowerCase().includes(searchTerm));
      });
      if (filtered.length > 0) {
        console.log("Fallback full-text search found:", filtered.length, "results");
      }
    }

    console.log("Filtered results:", filtered.length, "from", allRows.length);

    return new Response(JSON.stringify({
      success: true,
      search_params: { naziv, godina, status, kat_opcina, interni_broj, izradio },
      total_in_sdge: totalRecords,
      pages_fetched: Math.min(pagesToGet, Math.ceil(allRows.length / 12)),
      total_fetched: allRows.length,
      results_count: filtered.length,
      results: filtered,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
