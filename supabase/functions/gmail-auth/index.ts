import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_APP_ORIGIN = "https://geoterrainfo.com";

const isAllowedOrigin = (origin: string) => {
  if (!origin) return false;

  const exactAllowedOrigins = [
    "https://geoterrainfo.com",
    "https://www.geoterrainfo.com",
    "https://geoterrainfo.lovable.app",
    "http://localhost:8080",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:5173",
  ];

  if (exactAllowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname.endsWith(".vercel.app")) return true;
    if (hostname.endsWith(".lovable.app")) return true;

    return false;
  } catch {
    return false;
  }
};

const normalizeAppOrigin = (origin: string | null | undefined) => {
  const value = (origin || "").trim();
  return isAllowedOrigin(value) ? value : DEFAULT_APP_ORIGIN;
};

const normalizeAppRedirectUrl = (redirectUrl: string | null | undefined, fallbackOrigin: string) => {
  const fallbackUrl = `${fallbackOrigin}/settings`;
  const value = (redirectUrl || "").trim();
  if (!value) return fallbackUrl;

  try {
    const url = new URL(value, fallbackOrigin);
    if (!isAllowedOrigin(url.origin)) return fallbackUrl;
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackUrl;
  }
};

const withOAuthResult = (redirectUrl: string, key: "google" | "brain") => {
  const url = new URL(redirectUrl, DEFAULT_APP_ORIGIN);
  url.searchParams.set(key, "connected");
  url.searchParams.set("_cb", Date.now().toString());
  return url.toString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const parseState = (rawState: string | null): { userId: string; appOrigin: string; appRedirectUrl: string } | null => {
    if (!rawState) return null;

    if (/^[0-9a-fA-F-]{36}$/.test(rawState)) {
      return {
        userId: rawState,
        appOrigin: DEFAULT_APP_ORIGIN,
        appRedirectUrl: `${DEFAULT_APP_ORIGIN}/settings`,
      };
    }

    try {
      const decoded = atob(rawState);
      const parsed = JSON.parse(decoded) as { userId?: string; appOrigin?: string; appRedirectUrl?: string };

      if (!parsed.userId) return null;

      const appOrigin = normalizeAppOrigin(parsed.appOrigin);

      return {
        userId: parsed.userId,
        appOrigin,
        appRedirectUrl: normalizeAppRedirectUrl(parsed.appRedirectUrl, appOrigin),
      };
    } catch {
      return null;
    }
  };

  if (action === "auth-url") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { appOrigin?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-auth?action=callback`;

    const requestOrigin = req.headers.get("origin") || "";
    const appOrigin = normalizeAppOrigin(body.appOrigin || requestOrigin);
    const appRedirectUrl = normalizeAppRedirectUrl((body as { appRedirectUrl?: string }).appRedirectUrl, appOrigin);

    const state = btoa(JSON.stringify({ userId: user.id, appOrigin, appRedirectUrl }));

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly",
      access_type: "offline",
      prompt: "consent",
      state,
      login_hint: "geoterra@geoterrainfo.net",
    });

    return new Response(
      JSON.stringify({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (action === "callback" || (url.searchParams.get("code") && url.searchParams.get("state"))) {
    const code = url.searchParams.get("code");
    const stateData = parseState(url.searchParams.get("state"));

    if (!code || !stateData?.userId) {
      return new Response("Missing code or state", { status: 400 });
    }

    const { userId, appRedirectUrl } = stateData;
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-auth?action=callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Token exchange FAILED:", JSON.stringify(tokens));
      return new Response(`Token exchange failed: ${JSON.stringify(tokens)}`, { status: 400 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from("google_tokens").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      console.error("Failed saving google_tokens:", upsertError);
      return new Response(`Failed saving tokens: ${upsertError.message}`, { status: 500 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: withOAuthResult(appRedirectUrl, "google"),
      },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
