const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const BASE = "https://oss.uredjenazemlja.hr";

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

function getXsrf(jar: Map<string, string>): string {
  for (const [name, val] of jar.entries()) {
    if (name.toLowerCase().includes("xsrf") || name.toLowerCase().includes("csrf")) {
      return val.split("=").slice(1).join("=") || "";
    }
  }
  return "";
}

// ── Login na OSS s korisničkim podacima ──────────────────────
async function loginToOSS(username: string, password: string): Promise<{ cookies: string; xsrfToken: string; loggedIn: boolean }> {
  const jar = new Map<string, string>();

  // 1. Učitaj login stranicu
  const loginPage = await fetch(`${BASE}/login`, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
    redirect: "follow",
  });
  collectCookies(loginPage, jar);
  const loginHtml = await loginPage.text();

  // Izvuci CSRF token iz forme
  let csrfToken = "";
  const csrfMatch = loginHtml.match(/name="_csrf"\s+value="([^"]+)"/);
  if (csrfMatch) csrfToken = csrfMatch[1];

  const xsrfFromCookies = getXsrf(jar);

  // 2. Pošalji login podatke
  const loginBody = new URLSearchParams({
    username,
    password,
    ...(csrfToken ? { _csrf: csrfToken } : {}),
  });

  const loginResp = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": getCookies(jar),
      "Referer": `${BASE}/login`,
      "Origin": BASE,
      ...(xsrfFromCookies ? { "X-XSRF-TOKEN": xsrfFromCookies } : {}),
    },
    body: loginBody.toString(),
    redirect: "follow",
  });

  collectCookies(loginResp, jar);
  const loginRespText = await loginResp.text();

  // Provjeri je li login uspješan
  const loggedIn = !loginRespText.includes("Pogrešno korisničko ime") &&
                   !loginRespText.includes("Invalid credentials") &&
                   !loginRespText.includes("login?error") &&
                   loginResp.url !== `${BASE}/login?error`;

  console.log("[OSS Login] Status:", loginResp.status, "URL:", loginResp.url, "LoggedIn:", loggedIn);

  // 3. Dohvati authenticated session
  if (loggedIn) {
    const dashResp = await fetch(`${BASE}/oss/mvc/public-services/init`, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
        "Cookie": getCookies(jar),
        "Referer": BASE,
      },
      redirect: "follow",
    });
    collectCookies(dashResp, jar);
    await dashResp.text().catch(() => "");
  }

  return {
    cookies: getCookies(jar),
    xsrfToken: getXsrf(jar),
    loggedIn,
  };
}

// ── Pretraži katastarske općine ──────────────────────────────
async function searchMunicipalities(cookies: string, xsrfToken: string, query: string): Promise<any[]> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
    ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
  };

  const urls = [
    `${BASE}/oss/mvc/public-services/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
    `${BASE}/oss/mvc/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
    `${BASE}/oss/api/cadastre-municipality/search?query=${encodeURIComponent(query)}`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, { headers, redirect: "follow" });
      if (resp.ok) {
        const data = await resp.json();
        return Array.isArray(data) ? data : data.data || data.results || [];
      }
    } catch { continue; }
  }
  return [];
}

// ── Pretraži čestice ─────────────────────────────────────────
async function searchParcels(cookies: string, xsrfToken: string, munId: string, parcelNo: string): Promise<any> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/json",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
    ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
  };

  const urls = [
    `${BASE}/oss/mvc/public-services/cadastre-search/parcel?cadMunicipalityId=${munId}&parcelNumber=${encodeURIComponent(parcelNo)}`,
    `${BASE}/oss/mvc/cadastre-search/parcel?cadMunicipalityId=${munId}&parcelNumber=${encodeURIComponent(parcelNo)}`,
    `${BASE}/oss/api/cadastre-search/parcel?cadMunicipalityId=${munId}&parcelNumber=${encodeURIComponent(parcelNo)}`,
  ];

  for (const url of urls) {
    try {
      console.log("[OSS Parcel] Trying:", url);
      const resp = await fetch(url, { headers, redirect: "follow" });
      const text = await resp.text();
      console.log("[OSS Parcel] Response:", resp.status, text.slice(0, 200));
      if (resp.ok) {
        try { return JSON.parse(text); } catch { return { raw: text.slice(0, 2000) }; }
      }
    } catch (e) { console.error("[OSS Parcel] Error:", e); continue; }
  }
  return null;
}

// ── Preuzmi dokument (posjedovni list, ZK, kopija plana) ─────
async function downloadOSSDocument(cookies: string, xsrfToken: string, parcelId: string, docType: string): Promise<{ url?: string; base64?: string; error?: string }> {
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept": "application/pdf,*/*",
    "Cookie": cookies,
    "Referer": `${BASE}/public-services/search-cad-parcel`,
    "Origin": BASE,
    ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
  };

  // Različiti endpointi za različite dokumente
  const docUrls: Record<string, string[]> = {
    "posjedovni_list": [
      `${BASE}/oss/mvc/public-services/owner-sheet/pdf/${parcelId}`,
      `${BASE}/oss/api/public-services/owner-sheet/pdf/${parcelId}`,
    ],
    "kopija_plana": [
      `${BASE}/oss/mvc/public-services/cadastre-plan/pdf/${parcelId}`,
      `${BASE}/oss/api/public-services/cadastre-plan/pdf/${parcelId}`,
    ],
    "zk_izvadak": [
      `${BASE}/oss/mvc/public-services/land-registry/pdf/${parcelId}`,
      `${BASE}/oss/api/public-services/land-registry/pdf/${parcelId}`,
    ],
  };

  const urls = docUrls[docType] || docUrls["posjedovni_list"];

  for (const url of urls) {
    try {
      console.log("[OSS Doc] Trying:", url);
      const resp = await fetch(url, { headers, redirect: "follow" });
      console.log("[OSS Doc] Response:", resp.status, resp.headers.get("content-type"));

      if (resp.ok) {
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("pdf")) {
          const buffer = await resp.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          return { base64, url };
        }
        return { url };
      }
    } catch (e) {
      console.error("[OSS Doc] Error:", e);
      continue;
    }
  }
  return { error: "Dokument nije pronađen ili nije dostupan" };
}

// ── Glavni handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { cestica, katastarska_opcina, mode, parcel_id, doc_type } = body;

    const OSS_USERNAME = Deno.env.get("OSS_USERNAME");
    const OSS_PASSWORD = Deno.env.get("OSS_PASSWORD");

    if (!OSS_USERNAME || !OSS_PASSWORD) {
      return new Response(JSON.stringify({
        error: "OSS_USERNAME i OSS_PASSWORD nisu konfigurirani u Supabase Secrets",
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prijavi se na OSS
    console.log("[OSS] Logging in as:", OSS_USERNAME);
    const { cookies, xsrfToken, loggedIn } = await loginToOSS(OSS_USERNAME, OSS_PASSWORD);

    if (!loggedIn) {
      return new Response(JSON.stringify({
        error: "Prijava na OSS nije uspjela. Provjeri korisničke podatke.",
        hint: "Provjeri OSS_USERNAME i OSS_PASSWORD u Supabase Secrets",
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[OSS] Login successful!");

    // Preuzmi dokument ako je tražen
    if (mode === "download" && parcel_id) {
      const doc = await downloadOSSDocument(cookies, xsrfToken, parcel_id, doc_type || "posjedovni_list");
      return new Response(JSON.stringify({ success: true, loggedIn, ...doc }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pretraži čestice
    if (!cestica && !katastarska_opcina) {
      return new Response(JSON.stringify({
        error: "Potrebno je unijeti broj čestice i/ili katastarsku općinu",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Traži katastarsku općinu
    let municipalities: any[] = [];
    if (katastarska_opcina) {
      municipalities = await searchMunicipalities(cookies, xsrfToken, katastarska_opcina);
      console.log("[OSS] Municipalities found:", municipalities.length);
    }

    // Traži česticu
    let parcelResults: any = null;
    if (cestica && municipalities.length > 0) {
      const munId = municipalities[0].id || municipalities[0].koId || municipalities[0].cadastralMunicipalityId;
      if (munId) {
        parcelResults = await searchParcels(cookies, xsrfToken, String(munId), cestica);
      }
    }

    // Direktni linkovi
    const ossLink = `${BASE}/public-services/search-cad-parcel?cadMunicipalityName=${encodeURIComponent(katastarska_opcina || "")}&parcelNumber=${encodeURIComponent(cestica || "")}`;

    return new Response(JSON.stringify({
      success: true,
      loggedIn,
      cestica,
      katastarska_opcina,
      municipalities,
      parcel_results: parcelResults,
      links: {
        oss_search: ossLink,
        geoportal: `https://geoportal.dgu.hr/?parcel=${encodeURIComponent(cestica || "")}&municipality=${encodeURIComponent(katastarska_opcina || "")}`,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[OSS] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
