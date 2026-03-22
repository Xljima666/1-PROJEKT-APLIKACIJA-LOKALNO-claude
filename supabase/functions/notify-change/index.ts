import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "https://esm.sh/@pushforge/builder@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function rawKeyToJWK(privateKeyBase64: string, publicKeyBase64: string) {
  // Decode base64url private key (32 bytes = d)
  const padding = "=".repeat((4 - (privateKeyBase64.length % 4)) % 4);
  const privB64 = (privateKeyBase64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const privBytes = Uint8Array.from(atob(privB64), c => c.charCodeAt(0));

  // Decode base64url public key (65 bytes: 0x04 + 32 x + 32 y)
  const pubPadding = "=".repeat((4 - (publicKeyBase64.length % 4)) % 4);
  const pubB64 = (publicKeyBase64 + pubPadding).replace(/-/g, "+").replace(/_/g, "/");
  const pubBytes = Uint8Array.from(atob(pubB64), c => c.charCodeAt(0));

  // Convert to base64url (no padding)
  const toBase64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const x = pubBytes.slice(1, 33);
  const y = pubBytes.slice(33, 65);

  return {
    kty: "EC",
    crv: "P-256",
    x: toBase64Url(x),
    y: toBase64Url(y),
    d: toBase64Url(privBytes),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateJWK = rawKeyToJWK(vapidPrivateKey, vapidPublicKey);

    const body = await req.json();
    console.log("notify-change called with:", JSON.stringify(body));
    const { type, record, old_record } = body;

    let title = "";
    let notifBody = "";
    let excludeUserId: string | null = null;

    if (type === "INSERT" && record?.table === "comments") {
      const comment = record;
      const { data: card } = await supabase
        .from("cards")
        .select("title")
        .eq("id", comment.card_id)
        .single();
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", comment.user_id)
        .single();

      const commenterName = profile?.full_name || "Netko";
      title = "💬 Novi komentar";
      notifBody = `${commenterName} je komentirao na "${card?.title || "karticu"}"`;
      excludeUserId = comment.user_id;
    } else if (type === "INSERT" && record?.table === "workspace_items") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", record.user_id)
        .single();

      const userName = profile?.full_name || "Netko";
      title = "📋 Nova stavka na radnoj ploči";
      notifBody = `${userName}: ${record.text}`;
      excludeUserId = record.user_id;
    } else if (type === "comment") {
      const { data: card } = await supabase
        .from("cards")
        .select("title")
        .eq("id", body.card_id)
        .single();
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.user_id)
        .single();

      title = "💬 Novi komentar";
      notifBody = `${profile?.full_name || "Netko"} je komentirao na "${card?.title || "karticu"}"`;
      excludeUserId = body.user_id;
  } else if (type === "workspace_item") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", body.user_id)
      .single();

    title = "📋 Nova stavka na radnoj ploči";
    notifBody = `${profile?.full_name || "Netko"}: ${body.text}`;
    excludeUserId = body.user_id;
  } else if (type === "calendar_event") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", body.user_id)
      .single();

    title = "📅 Novi kalendarski događaj";
    notifBody = `${profile?.full_name || "Netko"} je dodao: ${body.title}`;
    excludeUserId = body.user_id;
  } else {
      return new Response(JSON.stringify({ message: "Unknown type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all push subscriptions except the user who triggered the change
    let query = supabase.from("push_subscriptions").select("*");
    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }
    const { data: subscriptions } = await query;
    console.log("Subscriptions found:", subscriptions?.length, "excludeUserId:", excludeUserId);

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No subscriptions to send to");
      return new Response(JSON.stringify({ message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const payload = JSON.stringify({ title, body: notifBody, url: "/dashboard" });

    for (const sub of subscriptions) {
      try {
        const { endpoint, headers, body: reqBody } = await buildPushHTTPRequest({
          privateJWK,
          subscription: {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message: {
            payload: { title, body: notifBody, url: "/dashboard" },
            adminContact: "mailto:geoterra@geoterrainfo.net",
          },
        });

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: reqBody,
        });

        if (res.ok || res.status === 201) sent++;
        else if (res.status === 404 || res.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push response:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Push failed:", err);
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
