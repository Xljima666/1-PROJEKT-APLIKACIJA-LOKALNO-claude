import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sanitizeAgentServerUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (!match?.[0]) return null;

  try {
    const parsed = new URL(match[0]);
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawAgentServerUrl = Deno.env.get("AGENT_SERVER_URL");
  const AGENT_API_KEY = Deno.env.get("AGENT_API_KEY");

  if (!rawAgentServerUrl || !AGENT_API_KEY) {
    return new Response(JSON.stringify({ error: "AGENT_SERVER_URL or AGENT_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = sanitizeAgentServerUrl(rawAgentServerUrl);
  if (!baseUrl) {
    return new Response(JSON.stringify({ error: "AGENT_SERVER_URL nije valjan URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL("/health", `${baseUrl}/`).toString();
    console.log(`[AgentHealth] Fetching ${url}`);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": AGENT_API_KEY,
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "GeoTerraAgent/1.0",
      },
    });

    const text = await res.text();
    console.log(`[AgentHealth] Status: ${res.status}, Body: ${text.slice(0, 500)}`);

    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[AgentHealth] Error:", e);
    return new Response(JSON.stringify({ error: `Agent nedostupan: ${String(e)}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
