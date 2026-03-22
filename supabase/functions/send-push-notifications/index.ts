import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "https://esm.sh/@pushforge/builder@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function rawKeyToJWK(privateKeyBase64: string, publicKeyBase64: string) {
  const padding = "=".repeat((4 - (privateKeyBase64.length % 4)) % 4);
  const privB64 = (privateKeyBase64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const privBytes = Uint8Array.from(atob(privB64), c => c.charCodeAt(0));

  const pubPadding = "=".repeat((4 - (publicKeyBase64.length % 4)) % 4);
  const pubB64 = (publicKeyBase64 + pubPadding).replace(/-/g, "+").replace(/_/g, "/");
  const pubBytes = Uint8Array.from(atob(pubB64), c => c.charCodeAt(0));

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

async function sendPush(
  privateJWK: any,
  sub: { endpoint: string; p256dh: string; auth: string },
  title: string,
  body: string,
  url: string,
): Promise<{ ok: boolean; status: number }> {
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
        payload: { title, body, url },
        adminContact: "mailto:geoterra@geoterrainfo.net",
      },
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: reqBody,
    });

    return { ok: res.ok || res.status === 201, status: res.status };
  } catch (err) {
    console.error("Push error:", err);
    return { ok: false, status: 0 };
  }
}

async function cleanupSub(supabase: any, subId: string) {
  await supabase.from("push_subscriptions").delete().eq("id", subId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Allow trusted cron caller OR authenticated admin user
    const providedSecret = req.headers.get("x-cron-secret") || req.headers.get("x-webhook-secret");
    const isTrustedCron = !!cronSecret && providedSecret === cronSecret;

    if (!isTrustedCron) {
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

      const { data: adminRole } = await supabase
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
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateJWK = rawKeyToJWK(vapidPrivateKey, vapidPublicKey);

    // Parse mode from body: "daily" (7:30 tomorrow tasks) or "sunday" (20:00 workboard)
    let mode = "daily";
    try {
      const body = await req.json();
      mode = body.mode || "daily";
    } catch {
      // default to daily
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;

    if (mode === "today") {
      // Send today's calendar tasks (6:45 AM)
      const now = new Date();
      // Convert to Zagreb time to get correct "today"
      const zagrebNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Zagreb" }));
      const todayStr = zagrebNow.toISOString().split("T")[0];

      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, user_id")
        .eq("event_date", todayStr);

      const { data: cards } = await supabase
        .from("cards")
        .select("id, title, due_date")
        .not("due_date", "is", null)
        .gte("due_date", todayStr + "T00:00:00")
        .lte("due_date", todayStr + "T23:59:59");

      const allTasks = [
        ...(events || []).map((e: any) => ({ title: e.title, user_id: e.user_id })),
        ...(cards || []).map((c: any) => ({ title: c.title, user_id: null })),
      ];

      if (allTasks.length === 0) {
        return new Response(
          JSON.stringify({ message: "No tasks for today", mode }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const sub of subscriptions) {
        const userTasks = allTasks.filter(
          (t) => t.user_id === sub.user_id || t.user_id === null
        );
        if (userTasks.length === 0) continue;

        const titles = userTasks.slice(0, 5).map((t) => t.title).join(", ");
        const bodyText = userTasks.length === 1
          ? `Danas: ${titles}`
          : `Danas imate ${userTasks.length} zadataka: ${titles}`;

        const result = await sendPush(privateJWK, sub, "🌅 Današnji zadaci", bodyText, "/calendar");
        if (result.ok) sent++;
        else if (result.status === 404 || result.status === 410) {
          await cleanupSub(supabase, sub.id);
        }
      }
    } else if (mode === "daily") {
      // Send tomorrow's calendar tasks to everyone
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, user_id")
        .eq("event_date", tomorrowStr);

      const { data: cards } = await supabase
        .from("cards")
        .select("id, title, due_date")
        .not("due_date", "is", null)
        .gte("due_date", tomorrowStr + "T00:00:00")
        .lte("due_date", tomorrowStr + "T23:59:59");

      const allTasks = [
        ...(events || []).map((e: any) => ({ title: e.title, user_id: e.user_id })),
        ...(cards || []).map((c: any) => ({ title: c.title, user_id: null })),
      ];

      if (allTasks.length === 0) {
        return new Response(
          JSON.stringify({ message: "No tasks for tomorrow", mode }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const sub of subscriptions) {
        const userTasks = allTasks.filter(
          (t) => t.user_id === sub.user_id || t.user_id === null
        );
        if (userTasks.length === 0) continue;

        const titles = userTasks.slice(0, 5).map((t) => t.title).join(", ");
        const bodyText = userTasks.length === 1
          ? `Sutra: ${titles}`
          : `Sutra imate ${userTasks.length} zadataka: ${titles}`;

        const result = await sendPush(privateJWK, sub, "📅 Sutrašnji zadaci", bodyText, "/calendar");
        if (result.ok) sent++;
        else if (result.status === 404 || result.status === 410) {
          await cleanupSub(supabase, sub.id);
        }
      }
    } else if (mode === "sunday") {
      // Sunday 20:00 - show workboard items
      const { data: workspaceItems } = await supabase
        .from("workspace_items")
        .select("*")
        .eq("completed", false);

      // Also get next week's calendar events (Mon-Sun)
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(monday.getDate() + 1); // tomorrow = Monday
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const mondayStr = monday.toISOString().split("T")[0];
      const sundayStr = sunday.toISOString().split("T")[0];

      const { data: weekEvents } = await supabase
        .from("calendar_events")
        .select("id, title")
        .gte("event_date", mondayStr)
        .lte("event_date", sundayStr);

      const { data: weekCards } = await supabase
        .from("cards")
        .select("id, title, due_date")
        .not("due_date", "is", null)
        .gte("due_date", mondayStr + "T00:00:00")
        .lte("due_date", sundayStr + "T23:59:59");

      const totalWeekTasks = (weekEvents?.length || 0) + (weekCards?.length || 0);
      const totalWorkItems = workspaceItems?.length || 0;

      const lines: string[] = [];
      if (totalWeekTasks > 0) {
        lines.push(`📅 ${totalWeekTasks} zadataka sljedeći tjedan`);
      }
      if (totalWorkItems > 0) {
        const items = workspaceItems!.slice(0, 3).map((w: any) => w.text).join(", ");
        lines.push(`📋 ${totalWorkItems} stavki na radnoj ploči: ${items}`);
      }

      if (lines.length === 0) {
        lines.push("Nema zadataka za sljedeći tjedan. 🎉");
      }

      const bodyText = lines.join("\n");

      for (const sub of subscriptions) {
        const result = await sendPush(privateJWK, sub, "🗓️ Tjedni pregled", bodyText, "/dashboard");
        if (result.ok) sent++;
        else if (result.status === 404 || result.status === 410) {
          await cleanupSub(supabase, sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ sent, total: subscriptions.length, mode }), {
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
