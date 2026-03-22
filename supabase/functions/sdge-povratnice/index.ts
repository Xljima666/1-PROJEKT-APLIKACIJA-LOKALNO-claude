const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
        const cp = v.split(";")[0];
        const [n] = cp.split("=");
        cookieJar.set(n.trim(), cp);
      }
    }
  };

  const getCookies = () => Array.from(cookieJar.values()).join("; ");

  const lp = await fetch("https://sdge.dgu.hr/login", {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  await lp.text();
  collectCookies(lp);

  const form = new URLSearchParams();
  form.append("username", SDGE_USERNAME);
  form.append("password", SDGE_PASSWORD);

  const lr = await fetch("https://sdge.dgu.hr/j_spring_security_check", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Cookie: getCookies(),
      Referer: "https://sdge.dgu.hr/login",
    },
    body: form.toString(),
    redirect: "manual",
  });
  collectCookies(lr);

  const loc = lr.headers.get("location");
  if (loc?.includes("error")) throw new Error("SDGE login failed");

  if (loc) {
    const u = loc.startsWith("http") ? loc : `https://sdge.dgu.hr${loc}`;
    const r = await fetch(u, {
      headers: { "User-Agent": UA, Cookie: getCookies() },
      redirect: "manual",
    });
    collectCookies(r);

    const l2 = r.headers.get("location");
    if (l2) {
      const u2 = l2.startsWith("http") ? l2 : `https://sdge.dgu.hr${l2}`;
      const r2 = await fetch(u2, {
        headers: { "User-Agent": UA, Cookie: getCookies() },
        redirect: "manual",
      });
      collectCookies(r2);
    }
  }

  const ar = await fetch("https://sdge.dgu.hr/app", {
    headers: { Cookie: getCookies(), "User-Agent": UA },
    redirect: "follow",
  });
  collectCookies(ar);
  const html = await ar.text();

  if (html.includes("<title>Prijava</title>")) throw new Error("Not logged in");

  const m = html.match(/vaadin\.initApplication\("([^"]+)"/);
  const vaadinAppId = m ? m[1] : "app-96801";

  return { getCookies, collectCookies, UA, vaadinAppId };
}

async function vaadinRpc(
  uiId: string,
  getCookies: () => string,
  UA: string,
  csrf: string,
  syncId: number,
  clientId: number,
  rpcCalls: any[],
  collectCookies?: (r: Response) => void,
) {
  const resp = await fetch(`https://sdge.dgu.hr/app/UIDL/?v-uiId=${uiId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Cookie: getCookies(),
      "User-Agent": UA,
    },
    body: JSON.stringify({ csrfToken: csrf, rpc: rpcCalls, syncId, clientId }),
  });

  if (collectCookies) collectCookies(resp);

  const text = await resp.text();
  return JSON.parse(text.replace(/^for\s*\(;;\)\s*;\s*/, ""));
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

    if (obj.k !== undefined && obj.d) {
      const key = String(obj.k);
      if (!seen.has(key)) {
        seen.add(key);
        const row: Record<string, string> = { _key: key };
        for (const [colId, value] of Object.entries(obj.d)) {
          row[`col_${colId}`] = String(value).replace(/<[^>]*>/g, "").trim();
        }
        results.push(row);
      }
    }

    for (const k of Object.keys(obj)) search(obj[k], depth + 1);
  };

  search(data);
  return results;
}

const COLUMN_MAP: Record<string, string> = {
  "1": "broj_predmeta",
  "2": "prijamni_broj",
  "3": "datum_dostave",
  "4": "datum_otpreme",
  "5": "dost_upisna",
  "6": "ino_adresa",
  "7": "nacin_otpreme",
  "8": "dostava",
  "9": "spremno",
  "10": "otpremljeno",
  "11": "razlog",
  "12": "naziv_otpravka",
  "13": "naziv_adresa_stranke",
  "14": "rbr_akta",
  "15": "oglasna_ploca",
  "16": "id",
  "17": "stranac",
  "18": "kt_oglasna_ploca",
  "19": "pravna",
};

function isChecked(val: string): boolean {
  return val.includes("xf046") || val.includes("✓") || val === "true";
}

function mapRow(raw: Record<string, string>): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "_key") continue;
    const colNum = key.replace("col_", "");
    const name = COLUMN_MAP[colNum] || key;

    if (["dost_upisna", "ino_adresa", "spremno", "otpremljeno", "oglasna_ploca", "stranac", "kt_oglasna_ploca", "pravna"].includes(name)) {
      mapped[name] = isChecked(value);
    } else {
      mapped[name] = value;
    }
  }
  return mapped;
}

function clickBtn(id: string) {
  return [
    id,
    "com.vaadin.shared.ui.button.ButtonServerRpc",
    "click",
    [{ altKey: false, button: "LEFT", clientX: 500, clientY: 400, ctrlKey: false, metaKey: false, relativeX: 10, relativeY: 10, shiftKey: false, type: 1 }],
  ];
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? "").toString().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function discoverHints(udl: any) {
  const tabSheetCandidates: string[] = [];
  const pagerNextCandidates: string[] = [];
  const dataCommunicatorCandidates: string[] = [];

  const state = udl?.state || {};
  for (const [pid, raw] of Object.entries(state)) {
    const s = raw as any;

    if (Array.isArray(s?.tabs) || s?.selected !== undefined && Array.isArray(s?.tabIds)) {
      tabSheetCandidates.push(pid);
    }

    const label = `${s?.text ?? ""} ${s?.caption ?? ""} ${s?.description ?? ""} ${s?.iconAltText ?? ""}`.toLowerCase().trim();
    if (label) {
      const isNext =
        [">", "›", "»", "next", "sljede", "iduća"].some((t) => label === t || label.includes(` ${t}`) || label.includes(`${t} `)) ||
        (label.length <= 20 && (label.includes("next") || label.includes("sljede") || label.includes(" >") || label.includes("> ")));

      if (isNext) pagerNextCandidates.push(pid);
    }

    const stateJson = JSON.stringify(s).toLowerCase();
    if (
      stateJson.includes("resetdataandsize") ||
      stateJson.includes("requestrows") ||
      stateJson.includes("sortorder") ||
      stateJson.includes("columnorder") ||
      stateJson.includes("datarow")
    ) {
      dataCommunicatorCandidates.push(pid);
    }
  }

  const typeMappings = udl?.typeMappings || {};
  const typeInheritanceMap = udl?.typeInheritanceMap || {};
  for (const [connectorId, typeId] of Object.entries(typeMappings)) {
    const parents = Array.isArray(typeInheritanceMap[String(typeId)])
      ? typeInheritanceMap[String(typeId)].map((p: any) => String(p).toLowerCase()).join(" ")
      : "";
    if (parents.includes("data") || parents.includes("grid") || parents.includes("communicator")) {
      dataCommunicatorCandidates.push(String(connectorId));
    }
  }

  return {
    tabSheetCandidates: uniqueIds(tabSheetCandidates),
    pagerNextCandidates: uniqueIds(pagerNextCandidates),
    dataCommunicatorCandidates: uniqueIds(dataCommunicatorCandidates),
  };
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
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);

      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      interni_broj,
      broj_predmeta,
      max_pages,
      tab_sheet_id,
      tab_index,
      pager_next_id,
      data_communicator_id,
      discover_only,
    } = body;

    const pagesToFetch = Math.min(max_pages || 155, 160); // Default: ALL pages
    const searchTerm = interni_broj || broj_predmeta || "";

    const { getCookies, collectCookies, UA, vaadinAppId } = await sdgeLogin();

    const now = Date.now();
    const ip = new URLSearchParams();
    ip.append("v-browserDetails", "1");
    ip.append("theme", "custom");
    ip.append("v-appId", vaadinAppId);
    ip.append("v-sh", "1080");
    ip.append("v-sw", "1920");
    ip.append("v-cw", "1920");
    ip.append("v-ch", "1080");
    ip.append("v-curdate", String(now));
    ip.append("v-tzo", "-60");
    ip.append("v-dstd", "60");
    ip.append("v-rtl", "false");
    ip.append("v-dpr", "1");
    ip.append("v-loc", "https://sdge.dgu.hr/app");
    ip.append("v-wn", vaadinAppId);

    const ir = await fetch(`https://sdge.dgu.hr/app/?v-${now}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: getCookies(),
        "User-Agent": UA,
      },
      body: ip.toString(),
    });

    collectCookies(ir);
    const outer = JSON.parse(await ir.text());
    const uiId = String(outer["v-uiId"] ?? "0");
    const uidl = typeof outer.uidl === "string" ? JSON.parse(outer.uidl) : outer.uidl;
    const csrf = uidl["Vaadin-Security-Key"] || "";
    let syncId = uidl.syncId ?? 0;
    let cid = 0;

    // 1) Click Upisnik (stable old ID, fallback behaviour if portal changes)
    const upisnikResult = await vaadinRpc(uiId, getCookies, UA, csrf, syncId, cid++, [clickBtn("125")], collectCookies);
    const upisnikUdl = Array.isArray(upisnikResult) ? upisnikResult[0] : upisnikResult;
    if (upisnikUdl?.syncId !== undefined) syncId = upisnikUdl.syncId;

    // 2) Discover tab/pager/data hints from current UDL
    const hintsBeforeTab = discoverHints(upisnikUdl);

    // 3) Switch to tab "Otprema/dostava"
    const selectedTabSheetId = String(tab_sheet_id || hintsBeforeTab.tabSheetCandidates[0] || "212");
    const selectedTabIndex = String(tab_index || "6");

    const otpResult = await vaadinRpc(
      uiId,
      getCookies,
      UA,
      csrf,
      syncId,
      cid++,
      [[selectedTabSheetId, "com.vaadin.shared.ui.tabsheet.TabsheetServerRpc", "setSelected", [selectedTabIndex]]],
      collectCookies,
    );

    const od = Array.isArray(otpResult) ? otpResult[0] : otpResult;
    if (od?.syncId !== undefined) syncId = od.syncId;

    const hintsAfterTab = discoverHints(od);

    const pagerNextCandidates = uniqueIds([
      pager_next_id ? String(pager_next_id) : null,
      ...hintsAfterTab.pagerNextCandidates,
      ...hintsBeforeTab.pagerNextCandidates,
      "751", // known historical fallback
      "199", // known fallback in other SDGE grids
    ]);

    const dataCommunicatorCandidates = uniqueIds([
      data_communicator_id ? String(data_communicator_id) : null,
      ...hintsAfterTab.dataCommunicatorCandidates,
      ...hintsBeforeTab.dataCommunicatorCandidates,
    ]);

    const allRows = extractAllRows(od);
    const seenKeys = new Set<string>();
    for (const r of allRows) if (r._key) seenKeys.add(r._key);

    const rowsPerPage = Math.max(1, allRows.length || 12);

    // Extract total count from pager text
    let totalRecords = 0;
    if (od?.state) {
      for (const st of Object.values(od.state)) {
        const s = st as any;
        if (s?.text && typeof s.text === "string" && s.text.includes("od ")) {
          const match = s.text.match(/od (\d+)/);
          if (match) totalRecords = parseInt(match[1]);
        }
      }
    }

    console.log("[Povratnice] Total records:", totalRecords, "First page rows:", allRows.length);
    console.log("[Povratnice] Pager next candidates:", pagerNextCandidates.slice(0, 8).join(",") || "none");
    console.log("[Povratnice] DataCommunicator candidates:", dataCommunicatorCandidates.slice(0, 8).join(",") || "none");

    if (discover_only) {
      return new Response(
        JSON.stringify({
          success: true,
          discover_only: true,
          first_page_rows: allRows.length,
          total_records: totalRecords,
          hints: {
            selected_tab_sheet_id: selectedTabSheetId,
            selected_tab_index: selectedTabIndex,
            tab_sheet_candidates: uniqueIds([...hintsBeforeTab.tabSheetCandidates, ...hintsAfterTab.tabSheetCandidates]),
            pager_next_candidates: pagerNextCandidates,
            data_communicator_candidates: dataCommunicatorCandidates,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let selectedDataCommunicatorId: string | null = null;

    // Probe DataCommunicator candidates (find the one that actually returns rows)
    for (const candidate of dataCommunicatorCandidates.slice(0, 25)) {
      try {
        const probeRes = await vaadinRpc(
          uiId,
          getCookies,
          UA,
          csrf,
          syncId,
          cid++,
          [[candidate, "com.vaadin.shared.data.DataRequestRpc", "requestRows", [0, rowsPerPage, 0, 0]]],
          collectCookies,
        );
        const probeUdl = Array.isArray(probeRes) ? probeRes[0] : probeRes;
        if (probeUdl?.syncId !== undefined) syncId = probeUdl.syncId;

        const probeRows = extractAllRows(probeUdl);
        if (probeRows.length > 0) {
          selectedDataCommunicatorId = candidate;
          for (const r of probeRows) {
            if (r._key && !seenKeys.has(r._key)) {
              seenKeys.add(r._key);
              allRows.push(r);
            }
          }
          console.log("[Povratnice] DataCommunicator selected:", candidate, "probeRows:", probeRows.length);
          break;
        }
      } catch {
        // Ignore bad candidate and continue probing
      }
    }

    let selectedPagerNextId: string | null = pagerNextCandidates[0] || null;
    let emptyPageStreak = 0;

    // Paginate using both strategies:
    // A) direct DataRequestRpc by offset (best when DataCommunicator is known)
    // B) click Next + optional DataRequestRpc fallback
    for (let page = 2; page <= pagesToFetch; page++) {
      let pageRows: Record<string, string>[] = [];

      // Strategy A: direct offset request
      if (selectedDataCommunicatorId) {
        try {
          const offset = (page - 1) * rowsPerPage;
          const dataRes = await vaadinRpc(
            uiId,
            getCookies,
            UA,
            csrf,
            syncId,
            cid++,
            [[selectedDataCommunicatorId, "com.vaadin.shared.data.DataRequestRpc", "requestRows", [offset, rowsPerPage, 0, 0]]],
            collectCookies,
          );
          const dataUdl = Array.isArray(dataRes) ? dataRes[0] : dataRes;
          if (dataUdl?.syncId !== undefined) syncId = dataUdl.syncId;
          pageRows = pageRows.concat(extractAllRows(dataUdl));
        } catch {
          // ignore and try strategy B
        }
      }

      // Strategy B: click next button (works when offset-based request isn't enough)
      if (pageRows.length === 0 && selectedPagerNextId) {
        try {
          const clickRes = await vaadinRpc(uiId, getCookies, UA, csrf, syncId, cid++, [clickBtn(selectedPagerNextId)], collectCookies);
          const clickUdl = Array.isArray(clickRes) ? clickRes[0] : clickRes;
          if (clickUdl?.syncId !== undefined) syncId = clickUdl.syncId;
          pageRows = pageRows.concat(extractAllRows(clickUdl));

          if (selectedDataCommunicatorId) {
            try {
              const afterClickDataRes = await vaadinRpc(
                uiId,
                getCookies,
                UA,
                csrf,
                syncId,
                cid++,
                [[selectedDataCommunicatorId, "com.vaadin.shared.data.DataRequestRpc", "requestRows", [0, rowsPerPage, 0, 0]]],
                collectCookies,
              );
              const afterClickDataUdl = Array.isArray(afterClickDataRes) ? afterClickDataRes[0] : afterClickDataRes;
              if (afterClickDataUdl?.syncId !== undefined) syncId = afterClickDataUdl.syncId;
              pageRows = pageRows.concat(extractAllRows(afterClickDataUdl));
            } catch {
              // keep already extracted rows
            }
          }
        } catch (e) {
          console.error(`[Povratnice] Next click failed for pager ${selectedPagerNextId}:`, e);
          break;
        }
      }

      let newCount = 0;
      for (const r of pageRows) {
        const key = r._key;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          allRows.push(r);
          newCount++;
        }
      }

      console.log(`[Povratnice] Page ${page}: ${pageRows.length} extracted, ${newCount} new (total: ${allRows.length})`);

      if (newCount === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 2) break;
      } else {
        emptyPageStreak = 0;
      }

      if (totalRecords > 0 && allRows.length >= totalRecords) break;
    }

    console.log("[Povratnice] Total rows fetched:", allRows.length);

    // Map + filter
    const mappedRows = allRows.map(mapRow);
    let results = mappedRows;

    if (searchTerm) {
      const term = String(searchTerm).toLowerCase();
      results = mappedRows.filter((r) => {
        for (const val of Object.values(r)) {
          if (typeof val === "string" && val.toLowerCase().includes(term)) return true;
        }
        return false;
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        search_term: searchTerm || null,
        total_fetched: mappedRows.length,
        results_count: results.length,
        results,
        debug: {
          total_records_reported: totalRecords,
          used_tab_sheet_id: selectedTabSheetId,
          used_tab_index: selectedTabIndex,
          used_pager_next_id: selectedPagerNextId,
          used_data_communicator_id: selectedDataCommunicatorId,
          discovered_tab_sheet_candidates: uniqueIds([...hintsBeforeTab.tabSheetCandidates, ...hintsAfterTab.tabSheetCandidates]),
          discovered_pager_next_candidates: pagerNextCandidates,
          discovered_data_communicator_candidates: dataCommunicatorCandidates,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Povratnice] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
