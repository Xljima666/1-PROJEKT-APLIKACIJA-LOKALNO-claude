import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  let userId: string;
  
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("getClaims failed, falling back to getUser:", claimsError);
      // Fallback to getUser
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("getUser also failed:", userError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }
  } catch (e) {
    console.error("Auth error:", e);
    // Final fallback
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = user.id;
  }

  // Get stored tokens
  const { data: tokenData } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) {
    return new Response(JSON.stringify({ error: "not_connected", emails: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let accessToken = tokenData.access_token;

  // Refresh if expired
  if (new Date(tokenData.expires_at) <= new Date()) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshRes.json();
    if (!refreshRes.ok) {
      return new Response(JSON.stringify({ error: "token_expired", emails: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    accessToken = refreshData.access_token;
    const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await supabaseAdmin.from("google_tokens").update({
      access_token: accessToken,
      expires_at: expiresAt,
    }).eq("user_id", userId);
  }

  // Fetch unread emails (max 5)
  try {
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+in:inbox&maxResults=10",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();

    if (!listRes.ok || !listData.messages) {
      return new Response(JSON.stringify({ emails: [], count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch details for each message
    const emails = await Promise.all(
      listData.messages.slice(0, 5).map(async (msg: { id: string }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgRes.json();

        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: { name: string; value: string }) => h.name === name)?.value || "";

        return {
          id: msg.id,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: msgData.snippet || "",
        };
      })
    );

    return new Response(JSON.stringify({
      emails,
      count: listData.resultSizeEstimate || emails.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gmail fetch error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch emails", emails: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
