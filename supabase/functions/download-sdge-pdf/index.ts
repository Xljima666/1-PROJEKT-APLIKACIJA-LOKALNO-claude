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
) {
  const payload: any = { csrfToken: csrf, rpc: rpcCalls, syncId, clientId };
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

// Deep search for download URLs and button-like components in Vaadin response
function findDownloadElements(data: any): { connectorIds: string[]; downloadUrls: string[]; buttons: any[] } {
  const connectorIds: string[] = [];
  const downloadUrls: string[] = [];
  const buttons: any[] = [];

  const search = (obj: any, path = "", depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 20) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) search(obj[i], `${path}[${i}]`, depth + 1);
      return;
    }

    // Look for FileDownloader connectors
    const str = JSON.stringify(obj);
    if (str.includes("FileDownloader") || str.includes("download") || str.includes("Download")) {
      connectorIds.push(path);
    }

    // Look for download URLs
    if (typeof obj.url === "string" && (obj.url.includes("dl") || obj.url.includes("download"))) {
      downloadUrls.push(obj.url);
    }

    // Look for buttons with PDF/download related captions
    if (obj.caption && typeof obj.caption === "string") {
      const cap = obj.caption.toLowerCase();
      if (cap.includes("pdf") || cap.includes("preuzmi") || cap.includes("download") || cap.includes("ispis") || cap.includes("print") || cap.includes("izvoz")) {
        buttons.push({ path, caption: obj.caption, id: path.split(".").pop() });
      }
    }

    for (const key of Object.keys(obj)) {
      search(obj[key], `${path}.${key}`, depth + 1);
    }
  };

  search(data);
  return { connectorIds, downloadUrls, buttons };
}

// Find all connector IDs with specific type patterns
function findConnectorsByType(data: any, typePatterns: string[]): string[] {
  const found: string[] = [];

  // Check typeInheritanceMap
  const typeMap = data?.typeMappings || {};
  const typeInheritance = data?.typeInheritanceMap || {};

  for (const [connId, typeNum] of Object.entries(typeMap)) {
    const parents = typeInheritance[String(typeNum)];
    if (Array.isArray(parents)) {
      for (const parent of parents) {
        const pStr = String(parent);
        if (typePatterns.some(p => pStr.includes(p))) {
          found.push(connId);
        }
      }
    }
  }

  return found;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { broj_predmeta, row_key, mode } = body;

    if (mode === "discover") {
      // Discovery mode: login, init, and return UI structure for debugging
      console.log("[SDGE PDF] Discovery mode");
    } else if (!broj_predmeta && !row_key) {
      return new Response(JSON.stringify({ success: false, error: "broj_predmeta is required (e.g. '10/2024')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Login
    const { getCookies, collectCookies, UA, vaadinAppId } = await sdgeLogin();
    console.log("[SDGE PDF] Login OK");

    // Step 2: Init app
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
    console.log("[SDGE PDF] Init OK, uiId:", uiId);

    // Extract rows from initial page
    const allRows = extractAllRows(uidl);
    console.log("[SDGE PDF] Initial rows:", allRows.length);

    if (mode === "discover") {
      // In discovery mode, return the full UI structure for analysis
      const downloads = findDownloadElements(uidl);
      const fileDownloaders = findConnectorsByType(uidl, ["FileDownloader", "Download", "BrowserWindowOpener"]);

      // Also collect all buttons
      const allButtons: any[] = [];
      const searchButtons = (obj: any, depth = 0) => {
        if (!obj || typeof obj !== "object" || depth > 20) return;
        if (Array.isArray(obj)) { for (const i of obj) searchButtons(i, depth + 1); return; }
        if (obj.caption) allButtons.push({ caption: obj.caption });
        for (const key of Object.keys(obj)) searchButtons(obj[key], depth + 1);
      };
      if (uidl?.state) searchButtons(uidl.state);

      return new Response(JSON.stringify({
        success: true,
        mode: "discover",
        rows_found: allRows.length,
        sample_rows: allRows.slice(0, 3),
        downloads,
        file_downloaders: fileDownloaders,
        all_buttons: allButtons.slice(0, 50),
        type_mappings_count: Object.keys(uidl?.typeMappings || {}).length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find target row
    let targetRow: Record<string, string> | null = null;
    let targetKey: string | null = row_key || null;

    if (broj_predmeta && !targetKey) {
      for (const row of allRows) {
        if (row.broj_predmeta && row.broj_predmeta.includes(broj_predmeta)) {
          targetRow = row;
          targetKey = row._key;
          break;
        }
      }

      // If not found on first page, paginate to find it
      if (!targetKey) {
        const nextButtonId = "199";
        const dataProviderConnId = "175";
        const seenKeys = new Set(allRows.map(r => r._key));

        for (let page = 2; page <= 10; page++) {
          try {
            const pageResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
              [nextButtonId, "com.vaadin.shared.ui.button.ButtonServerRpc", "click", [
                { altKey: false, button: "LEFT", clientX: 500, clientY: 400, ctrlKey: false, metaKey: false, relativeX: 10, relativeY: 10, shiftKey: false, type: 1 }
              ]]
            ], collectCookies);
            const pd = Array.isArray(pageResult) ? pageResult[0] : pageResult;
            if (pd?.syncId !== undefined) currentSyncId = pd.syncId;

            const dataResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
              [dataProviderConnId, "com.vaadin.shared.data.DataRequestRpc", "requestRows", [0, 12, 0, 0]]
            ], collectCookies);
            const dd = Array.isArray(dataResult) ? dataResult[0] : dataResult;
            if (dd?.syncId !== undefined) currentSyncId = dd.syncId;

            const pageRows = extractAllRows(dd);
            for (const row of pageRows) {
              if (row._key && !seenKeys.has(row._key)) {
                seenKeys.add(row._key);
                allRows.push(row);
                if (row.broj_predmeta && row.broj_predmeta.includes(broj_predmeta)) {
                  targetRow = row;
                  targetKey = row._key;
                  break;
                }
              }
            }
            if (targetKey) break;
            if (pageRows.length === 0) break;
          } catch (e) {
            console.error(`[SDGE PDF] Page ${page} error:`, e);
            break;
          }
        }
      }
    }

    if (!targetKey) {
      return new Response(JSON.stringify({
        success: false,
        error: `Predmet "${broj_predmeta}" nije pronađen u SDGE-u. Pronađeno ${allRows.length} predmeta na pretraženim stranicama.`,
        available: allRows.slice(0, 5).map(r => r.broj_predmeta),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[SDGE PDF] Found target:", targetKey, targetRow?.broj_predmeta);

    // Step 3: Click on the row to select/open it
    // Vaadin Grid uses DataCommunicator selection - try clicking the row via Grid's item click
    // The Grid connector ID in SDGE appears to be around 172-176 range based on the search function
    const gridConnId = "172"; // Grid component

    // Try selecting the row via Grid's selection model
    const selectResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
      [gridConnId, "com.vaadin.shared.ui.grid.GridServerRpc", "itemClick", [
        targetKey, // row key
        "1", // column internal id (broj_predmeta)
        { altKey: false, button: "LEFT", clientX: 500, clientY: 400, ctrlKey: false, metaKey: false, relativeX: 10, relativeY: 10, shiftKey: false, type: 1 },
        0, // section (0 = body)
      ]]
    ], collectCookies);

    const selectData = Array.isArray(selectResult) ? selectResult[0] : selectResult;
    if (selectData?.syncId !== undefined) currentSyncId = selectData.syncId;

    console.log("[SDGE PDF] Row click result keys:", Object.keys(selectData || {}).join(", "));

    // Analyze the response for download elements, new buttons, etc.
    const downloads = findDownloadElements(selectData);
    const fileDownloaders = findConnectorsByType(selectData, ["FileDownloader", "Download", "BrowserWindowOpener", "OnDemandFileDownloader"]);

    // Collect all new buttons from the detail view
    const detailButtons: any[] = [];
    if (selectData?.state) {
      for (const [pid, st] of Object.entries(selectData.state)) {
        const s = st as any;
        if (s?.caption) {
          detailButtons.push({ id: pid, caption: s.caption });
        }
      }
    }

    console.log("[SDGE PDF] Detail buttons:", JSON.stringify(detailButtons));
    console.log("[SDGE PDF] Downloads found:", JSON.stringify(downloads));
    console.log("[SDGE PDF] FileDownloaders:", JSON.stringify(fileDownloaders));

    // Try to find a PDF/download button and click it
    let pdfButtonId: string | null = null;
    for (const btn of [...downloads.buttons, ...detailButtons]) {
      const cap = (btn.caption || "").toLowerCase();
      if (cap.includes("pdf") || cap.includes("preuzmi") || cap.includes("download") || cap.includes("ispis") || cap.includes("print") || cap.includes("izvoz") || cap.includes("pregled")) {
        pdfButtonId = btn.id;
        break;
      }
    }

    // Also check for FileDownloader extensions
    let downloadConnectorId: string | null = null;
    if (selectData?.changes) {
      const changesStr = JSON.stringify(selectData.changes);
      // Look for FileDownloader pattern in changes
      const fdMatch = changesStr.match(/"(\d+)"[^}]*FileDownloader/);
      if (fdMatch) downloadConnectorId = fdMatch[1];
    }

    // If we found a button, try clicking it
    if (pdfButtonId) {
      console.log("[SDGE PDF] Clicking PDF button:", pdfButtonId);
      const pdfResult = await vaadinRpc(uiId, getCookies, UA, csrf, currentSyncId, clientId++, [
        [pdfButtonId, "com.vaadin.shared.ui.button.ButtonServerRpc", "click", [
          { altKey: false, button: "LEFT", clientX: 500, clientY: 400, ctrlKey: false, metaKey: false, relativeX: 10, relativeY: 10, shiftKey: false, type: 1 }
        ]]
      ], collectCookies);
      const pdfData = Array.isArray(pdfResult) ? pdfResult[0] : pdfResult;
      if (pdfData?.syncId !== undefined) currentSyncId = pdfData.syncId;

      // Check for download URL in the response
      const pdfDownloads = findDownloadElements(pdfData);
      console.log("[SDGE PDF] PDF click result:", JSON.stringify(pdfDownloads));

      // Try to find a connector download URL
      if (pdfData?.changes) {
        const changesStr = JSON.stringify(pdfData.changes);
        // Look for download URL pattern
        const urlMatch = changesStr.match(/dl[^"]*|connector\/([^"]+)/);
        if (urlMatch) {
          console.log("[SDGE PDF] Found potential download URL:", urlMatch[0]);
        }
      }
    }

    // Try direct connector download if we found a FileDownloader
    if (downloadConnectorId || fileDownloaders.length > 0) {
      const dlConnId = downloadConnectorId || fileDownloaders[0];
      const dlUrl = `https://sdge.dgu.hr/app/connector/${uiId}/${dlConnId}/dl`;
      console.log("[SDGE PDF] Trying direct download:", dlUrl);

      const dlResp = await fetch(dlUrl, {
        headers: { "Cookie": getCookies(), "User-Agent": UA },
        redirect: "follow",
      });

      if (dlResp.ok) {
        const contentType = dlResp.headers.get("content-type") || "";
        if (contentType.includes("pdf") || contentType.includes("octet-stream")) {
          const pdfBytes = await dlResp.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
          console.log("[SDGE PDF] PDF downloaded, size:", pdfBytes.byteLength);
          return new Response(JSON.stringify({
            success: true,
            broj_predmeta: targetRow?.broj_predmeta || broj_predmeta,
            pdf_base64: base64,
            pdf_size: pdfBytes.byteLength,
            content_type: contentType,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          console.log("[SDGE PDF] Download response is not PDF:", contentType);
        }
      } else {
        console.log("[SDGE PDF] Download failed:", dlResp.status);
      }
    }

    // Return discovery info if we couldn't download
    return new Response(JSON.stringify({
      success: false,
      error: "Nisam uspio pronaći gumb za preuzimanje PDF-a. Potrebna je analiza SDGE sučelja.",
      predmet: targetRow,
      detail_buttons: detailButtons,
      downloads_found: downloads,
      file_downloaders: fileDownloaders,
      hint: "Pokušaj s mode='discover' za potpunu analizu UI strukture, ili provjeri ručno u SDGE-u koji gumb koristi za PDF.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[SDGE PDF] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
