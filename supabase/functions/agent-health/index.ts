import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEALTH_TIMEOUT_MS = 8000;
const FALLBACK_AGENT_API_KEY = "promijeni-me-na-siguran-kljuc-123";

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

const sanitizeAgentApiKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const k1 = trimmed.match(/AGENT_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k1) return k1;
  const k2 = trimmed.match(/X-API-Key\s*:\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k2) return k2;
  return trimmed.replace(/^[`"']+|[`"']+$/g, "").split(/\s+/)[0]?.trim() || null;
};

const getAgentApiKeyCandidates = (raw: string | null): string[] => {
  const candidates = new Set<string>();
  if (raw) {
    const parsed = sanitizeAgentApiKey(raw);
    if (parsed) candidates.add(parsed);
  }
  candidates.add(FALLBACK_AGENT_API_KEY);
  return Array.from(candidates);
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const rawAgentServerUrl = Deno.env.get("AGENT_SERVER_URL");
  const rawAgentApiKey = Deno.env.get("AGENT_API_KEY");

  if (!rawAgentServerUrl) {
    return new Response(JSON.stringify({ ok: false, error: "AGENT_SERVER_URL not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = sanitizeAgentServerUrl(rawAgentServerUrl);
  if (!baseUrl) {
    return new Response(JSON.stringify({ ok: false, error: "AGENT_SERVER_URL nije valjan URL" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL("/health", `${baseUrl}/`).toString();
  const apiKeyCandidates = getAgentApiKeyCandidates(rawAgentApiKey || null);

  try {
    for (const apiKey of apiKeyCandidates) {
      const res = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgent/1.0",
          },
        },
        HEALTH_TIMEOUT_MS,
      );

      const text = await res.text();
      console.log(`[AgentHealth] ${url} -> ${res.status} ${text.slice(0, 300)}`);

      if (res.status === 401) continue;

      let payload: Record<string, unknown> = { ok: res.ok, status: res.status };
      try {
        const parsed = text ? JSON.parse(text) : {};
        if (parsed && typeof parsed === "object") payload = { ...payload, ...parsed };
      } catch {
        payload.raw = text;
      }
 
      return new Response(JSON.stringify(payload), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Agent HTTP 401: Nevažeći API ključ" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[AgentHealth] Error:", message);
    return new Response(JSON.stringify({ ok: false, error: `Agent nedostupan: ${message}` }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
