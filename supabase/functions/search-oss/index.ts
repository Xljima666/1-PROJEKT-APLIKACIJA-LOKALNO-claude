const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BASE = "https://oss.uredjenazemlja.hr";

// Cookie helper
function collectCookies(resp: Response, jar: Map<string, string>) {
  for (const [k, v] of resp.headers.entries()) {
    if (k.toLowerCase() === "set-cookie") {
      const cp = v.split(";")[0];
      const [name] = cp.split("=");
      jar.set(name.trim(), cp);
    }
  }
}
function getCookies(jar: Map<string, string>) {
  return Array.from(jar.values()).join("; ");
}

// Step 1: Get a session by loading the public services page
async function getSession(): Promise<{ cookies: string; xsrfToken: string }> {
  const jar = new Map<string, string>();

  // Load the main page to get initial cookies
  const mainResp = await fetch(`${BASE}/public-services/search-cad-parcel`, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
    redirect: "follow",
  });
  collectCookies(mainResp, jar);
  await mainResp.text();

  // Try to load the OSS app to get more cookies/session
  const ossResp = await fetch(`${BASE}/oss/mvc/public-services/init`, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "Cookie": getCookies(jar),
      "Referer": `${BASE}/public-services/search-cad-parcel`,
      "Origin": BASE,
    },
    redirect: "follow",
  });
  collectCookies(ossResp, jar);
  await ossResp.text().catch(() => "");

  // Extract XSRF token from cookies
  let xsrfToken = "";
  for (const [name, val] of jar.entries()) {
    if (name.toLowerCase().includes("xsrf") || name.toLowerCase().includes("csrf")) {
      xsrfToken = val.split("=")[1] || "";
    }
  }

  return { cookies: getCookies(jar), xsrfToken };
}

// Step 2: Search for cadastral municipalities
async function searchCadMunicipalities(
  cookies: string,
  xsrfToken: string,
  query: string,
): Promise<any[]> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  // Try various API patterns for municipality search
  const patterns = [
    `${BASE}/oss/mvc/public-services/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
    `${BASE}/oss/mvc/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
    `${BASE}/oss/api/public-services/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
  ];

  for (const url of patterns) {
    try {
      const resp = await fetch(url, { headers, redirect: "follow" });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data) ? data : data.data || data.results || [data];
      }
      await resp.text();
    } catch {
      continue;
    }
  }
  return [];
}

// Step 3: Search for parcels
async function searchParcels(
  cookies: string,
  xsrfToken: string,
  cadMunicipalityId: string,
  parcelNumber: string,
): Promise<any> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  const patterns = [
    `${BASE}/oss/mvc/public-services/cadastre-search/parcel?cadMunicipalityId=${cadMunicipalityId}&parcelNumber=${encodeURIComponent(parcelNumber)}`,
    `${BASE}/oss/mvc/cadastre-search/parcel?cadMunicipalityId=${cadMunicipalityId}&parcelNumber=${encodeURIComponent(parcelNumber)}`,
    `${BASE}/oss/api/public-services/cadastre-search/parcel?cadMunicipalityId=${cadMunicipalityId}&parcelNumber=${encodeURIComponent(parcelNumber)}`,
  ];

  for (const url of patterns) {
    try {
      console.log("[OSS] Trying:", url);
      const resp = await fetch(url, { headers, redirect: "follow" });
      const text = await resp.text();
      console.log("[OSS] Response:", resp.status, text.slice(0, 200));
      if (resp.ok) {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text.slice(0, 2000) };
        }
      }
    } catch (e) {
      console.error("[OSS] Error:", e);
      continue;
    }
  }
  return null;
}

// Alternative: Use the global OSS search
async function ossGlobalSearch(
  cookies: string,
  xsrfToken: string,
  query: string,
): Promise<any> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
  };
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken;

  const patterns = [
    `${BASE}/oss/mvc/public/search?query=${encodeURIComponent(query)}&limit=20&offset=0`,
    `${BASE}/oss/mvc/public-services/search?query=${encodeURIComponent(query)}&limit=20`,
    `${BASE}/oss/api/public/search?query=${encodeURIComponent(query)}&limit=20`,
  ];

  for (const url of patterns) {
    try {
      console.log("[OSS Global] Trying:", url);
      const resp = await fetch(url, { headers, redirect: "follow" });
      const text = await resp.text();
      console.log("[OSS Global] Response:", resp.status, text.slice(0, 300));
      if (resp.ok) {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text.slice(0, 2000) };
        }
      }
    } catch (e) {
      console.error("[OSS Global] Error:", e);
      continue;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { cestica, katastarska_opcina, mode } = body;

    if (!cestica && !katastarska_opcina) {
      return new Response(JSON.stringify({
        error: "Potrebno je unijeti broj čestice i/ili katastarsku općinu",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[OSS] Search params:", JSON.stringify({ cestica, katastarska_opcina, mode }));

    // Get session
    const { cookies, xsrfToken } = await getSession();
    console.log("[OSS] Session obtained, cookies:", cookies ? "yes" : "no", "xsrf:", xsrfToken ? "yes" : "no");

    // Build search query
    const searchQuery = [cestica, katastarska_opcina].filter(Boolean).join(" ");

    // Try global search first
    const globalResults = await ossGlobalSearch(cookies, xsrfToken, searchQuery);

    // Also try municipality search if kat_opcina provided
    let municipalities: any[] = [];
    if (katastarska_opcina) {
      municipalities = await searchCadMunicipalities(cookies, xsrfToken, katastarska_opcina);
    }

    // Try specific parcel search if we have municipality info
    let parcelResults: any = null;
    if (cestica && municipalities.length > 0) {
      const munId = municipalities[0].id || municipalities[0].koId || municipalities[0].cadastralMunicipalityId;
      if (munId) {
        parcelResults = await searchParcels(cookies, xsrfToken, String(munId), cestica);
      }
    }

    // Build the direct OSS link for user reference
    const ossLink = katastarska_opcina
      ? `${BASE}/public-services/search-cad-parcel?cadMunicipalityName=${encodeURIComponent(katastarska_opcina)}&parcelNumber=${encodeURIComponent(cestica || "")}`
      : `${BASE}/public-services/search-cad-parcel`;

    // Build alternative search links
    const links = {
      oss_search: ossLink,
      oss_main: `${BASE}/public-services/search-cad-parcel`,
      geoportal: `https://geoportal.dgu.hr/?parcel=${encodeURIComponent(cestica || "")}&municipality=${encodeURIComponent(katastarska_opcina || "")}`,
    };

    return new Response(JSON.stringify({
      success: true,
      cestica,
      katastarska_opcina,
      global_results: globalResults,
      municipalities,
      parcel_results: parcelResults,
      links,
      note: globalResults === null && parcelResults === null
        ? "OSS API zahtijeva autorizaciju za API pristup. Koristite direktni link za pretragu u pregledniku."
        : undefined,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OSS] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
