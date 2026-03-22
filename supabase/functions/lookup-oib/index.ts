const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OibResult {
  source: string;
  data: any;
  error?: string;
}

// Validate OIB format (11 digits, valid checksum)
function isValidOib(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false;
  let a = 10;
  for (let i = 0; i < 10; i++) {
    a = (a + parseInt(oib[i])) % 10;
    if (a === 0) a = 10;
    a = (a * 2) % 11;
  }
  return (11 - a) % 10 === parseInt(oib[10]);
}

// 1. Sudreg API - Court registry (public API)
async function searchSudreg(oib: string): Promise<OibResult> {
  try {
    // Search by OIB in court registry
    const res = await fetch(
      `https://sudreg-api.pravosudje.hr/javni/subjekt_detalji?oib=${oib}&expand_relations=true`,
      {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
        return { source: "sudreg", data };
      }
    }

    // Try search endpoint
    const searchRes = await fetch(
      `https://sudreg-api.pravosudje.hr/javni/subjekt?oib=${oib}`,
      {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData && (Array.isArray(searchData) ? searchData.length > 0 : Object.keys(searchData).length > 0)) {
        return { source: "sudreg", data: searchData };
      }
    }
    return { source: "sudreg", data: null, error: "Nema podataka u sudskom registru za ovaj OIB" };
  } catch (e) {
    console.error("[Sudreg] Error:", e);
    return { source: "sudreg", data: null, error: String(e) };
  }
}

// 2. FINA RGFI - Financial reports registry (web scrape)
async function searchFinaRgfi(oib: string): Promise<OibResult> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return { source: "fina_rgfi", data: null, error: "Firecrawl not configured" };
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://rgfi.fina.hr/JavsnaObjava-web/izbornik/ppipoIzvworkaroundNoChange.do?oib=${oib}`,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const markdown = data.data?.markdown || data.markdown || "";
      if (markdown && markdown.length > 50) {
        return { source: "fina_rgfi", data: { content: markdown.slice(0, 4000) } };
      }
    }
    return { source: "fina_rgfi", data: null, error: "Nema financijskih izvještaja" };
  } catch (e) {
    console.error("[FINA RGFI] Error:", e);
    return { source: "fina_rgfi", data: null, error: String(e) };
  }
}

// 3. Bisnode/Fininfo - Company info (web scrape)
async function searchFininfo(oib: string): Promise<OibResult> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) {
    return { source: "fininfo", data: null, error: "Firecrawl not configured" };
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.fininfo.hr/Poduzece/Pregled/oib/${oib}`,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const markdown = data.data?.markdown || data.markdown || "";
      if (markdown && markdown.length > 50 && !markdown.includes("nije pronađen")) {
        return { source: "fininfo", data: { content: markdown.slice(0, 4000) } };
      }
    }
    return { source: "fininfo", data: null, error: "Nema podataka na Fininfo" };
  } catch (e) {
    console.error("[Fininfo] Error:", e);
    return { source: "fininfo", data: null, error: String(e) };
  }
}

// 4. Search internal GeoTerra app cards by OIB
async function searchGeoterraByOib(oib: string): Promise<OibResult> {
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: cards } = await supabase
      .from("cards")
      .select("id, title, narucitelj_ime, narucitelj_oib, narucitelj_adresa, kontakt, katastarska_opcina, katastarska_cestica, status, vrsta_posla")
      .eq("narucitelj_oib", oib);
    
    if (cards && cards.length > 0) {
      return { source: "geoterra_app", data: cards };
    }
    return { source: "geoterra_app", data: null, error: "Nema kartica s ovim OIB-om" };
  } catch (e) {
    console.error("[GeoTerra] Error:", e);
    return { source: "geoterra_app", data: null, error: String(e) };
  }
}

// 5. SDGE search by narucitelj containing OIB info
async function searchSdgeByOib(oib: string): Promise<OibResult> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/search-sdge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")!}`,
      },
      body: JSON.stringify({ naziv: oib, max_pages: 3 }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return { source: "sdge", data: data.results.slice(0, 10) };
      }
    }
    return { source: "sdge", data: null, error: "Nema SDGE predmeta za ovaj OIB" };
  } catch (e) {
    console.error("[SDGE] Error:", e);
    return { source: "sdge", data: null, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedInternalSecret = Deno.env.get("CRON_SECRET");

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const isInternalCall = !!expectedInternalSecret && internalSecret === expectedInternalSecret;

    if (!isInternalCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      const callerUserId = claimsData?.claims?.sub;

      if (claimsError || !callerUserId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", callerUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const { oib } = await req.json();
    if (!oib || typeof oib !== "string") {
      return new Response(JSON.stringify({ error: "OIB je obavezan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanOib = oib.replace(/\s/g, "").trim();
    if (!isValidOib(cleanOib)) {
      return new Response(JSON.stringify({ error: `Nevažeći OIB: ${cleanOib}. OIB mora imati 11 znamenki s ispravnim kontrolnim brojem.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[OIB Lookup] Searching for OIB: ${cleanOib}`);

    // Run all searches in parallel
    const [sudreg, finaRgfi, fininfo, geoterra, sdge] = await Promise.all([
      searchSudreg(cleanOib),
      searchFinaRgfi(cleanOib),
      searchFininfo(cleanOib),
      searchGeoterraByOib(cleanOib),
      searchSdgeByOib(cleanOib),
    ]);

    const results = { sudreg, fina_rgfi: finaRgfi, fininfo, geoterra_app: geoterra, sdge };
    const sourcesWithData = Object.values(results).filter(r => r.data !== null).length;

    console.log(`[OIB Lookup] Found data in ${sourcesWithData}/5 sources`);

    return new Response(JSON.stringify({
      success: true,
      oib: cleanOib,
      sources_checked: 5,
      sources_with_data: sourcesWithData,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OIB Lookup] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
