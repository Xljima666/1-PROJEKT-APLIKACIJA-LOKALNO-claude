import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_BRAIN_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_BRAIN_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Step 1: Generate auth URL with nonce-based CSRF protection
  if (action === "auth-url") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Generate cryptographic nonce and store mapping to user_id
    const nonce = crypto.randomUUID();
    
    // Clean up expired nonces first
    await supabaseAdmin.rpc("cleanup_expired_nonces");
    
    // Store nonce -> user_id mapping (expires in 10 min via cleanup function)
    await supabaseAdmin.from("oauth_nonces").insert({
      nonce,
      user_id: user.id,
    });

    const redirectUri = `${SUPABASE_URL}/functions/v1/brain-auth?action=callback`;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/drive",
      access_type: "offline",
      prompt: "consent",
      state: nonce, // Send nonce instead of user_id
      login_hint: "markopetronijevic666@gmail.com",
    });

    return new Response(JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Step 2: OAuth callback - verify nonce and exchange code for tokens
  if (action === "callback") {
    const code = url.searchParams.get("code");
    const nonce = url.searchParams.get("state");

    if (!code || !nonce) {
      return new Response("Missing code or state", { status: 400 });
    }

    // Look up nonce to get the real user_id (server-side verification)
    const { data: nonceRecord, error: nonceError } = await supabaseAdmin
      .from("oauth_nonces")
      .select("user_id, created_at")
      .eq("nonce", nonce)
      .single();

    if (nonceError || !nonceRecord) {
      return new Response("Invalid or expired OAuth state", { status: 400 });
    }

    // Check nonce is not older than 10 minutes
    const nonceAge = Date.now() - new Date(nonceRecord.created_at).getTime();
    if (nonceAge > 10 * 60 * 1000) {
      await supabaseAdmin.from("oauth_nonces").delete().eq("nonce", nonce);
      return new Response("OAuth state expired", { status: 400 });
    }

    const userId = nonceRecord.user_id;

    // Delete used nonce immediately
    await supabaseAdmin.from("oauth_nonces").delete().eq("nonce", nonce);

    const redirectUri = `${SUPABASE_URL}/functions/v1/brain-auth?action=callback`;

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
      return new Response(`Token exchange failed: ${JSON.stringify(tokens)}`, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabaseAdmin.from("google_brain_tokens").upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    }, { onConflict: "user_id" });

    return new Response(null, {
      status: 302,
      headers: { Location: "https://geoterrainfo.lovable.app/dashboard" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
