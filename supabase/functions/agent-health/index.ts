import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEALTH_TIMEOUT_MS = 8000;
// VAŽNO: Ovo je samo fallback za razvoj. U produkciji obavezno postavite pravi AGENT_API_KEY u env varijable!
const FALLBACK_AGENT_API_KEY = "geo-terra-agent-2026-v1-prod-key-84f2a9";

const sanitizeAgentServerUrl = (raw: string): string | null => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  if (!match?.[0]) return null;

  try {
    const parsed = new URL(match[0]);
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    const cleanUrl = parsed.toString().replace(/\/$/, "");
    return cleanUrl;
  } catch {
    return null;
  }
};

const sanitizeAgentApiKey = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Podrška za env format, header format ili direktan ključ
  const k1 = trimmed.match(/AGENT_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k1) return k1;

  const k2 = trimmed.match(/X-API-Key\s*:\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k2) return k2;

  return trimmed.replace(/^[`"']+|[`"']+$/g, "").split(/\s+/)[0]?.trim() || null;
};

const maskKey = (key: string): string => {
  if (key.length < 8) return "****";
  return key.slice(0, 8) + "••••••••";
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
  const start = Date.now();

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const duration = Date.now() - start;
    return { res, duration };
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
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: "AGENT_SERVER_URL nije postavljen u environment varijablama" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const baseUrl = sanitizeAgentServerUrl(rawAgentServerUrl);
  if (!baseUrl) {
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: "AGENT_SERVER_URL nije valjan URL",
        providedValue: rawAgentServerUrl 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const healthUrl = new URL("/health", `${baseUrl}/`).toString();
  const apiKeyCandidates = getAgentApiKeyCandidates(rawAgentApiKey);

  const result = {
    ok: false,
    testedUrl: healthUrl,
    timestamp: new Date().toISOString(),
    candidatesCount: apiKeyCandidates.length,
    usedKeyMasked: "",
    durationMs: 0,
    status: 0,
    error: "",
    agentResponse: null as any,
  };

  try {
    for (const apiKey of apiKeyCandidates) {
      const masked = maskKey(apiKey);
      result.usedKeyMasked = masked;

      const { res, duration } = await fetchWithTimeout(
        healthUrl,
        {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgentHealth/1.1",
          },
        },
        HEALTH_TIMEOUT_MS,
      );

      result.durationMs = duration;
      result.status = res.status;

      const text = await res.text();
      console.log(`[AgentHealth] ${healthUrl} → ${res.status} (${duration}ms) key=${masked} | ${text.slice(0, 180)}`);

      if (res.status === 401 || res.status === 403) {
        console.log(`[AgentHealth] Ključ ${masked} odbijen, pokušavam sljedeći...`);
        continue;
      }

      let payload: Record<string, unknown> = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload.raw = text.slice(0, 500);
      }

      const finalResponse = {
        ...result,
        ok: res.ok,
        agentResponse: payload,
      };

      return new Response(JSON.stringify(finalResponse), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Svi ključevi su pali na 401/403
    return new Response(
      JSON.stringify({
        ...result,
        ok: false,
        error: "Svi API ključevi odbijeni (401/403). Provjerite AGENT_API_KEY.",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[AgentHealth] Critical error:", message);

    return new Response(
      JSON.stringify({
        ...result,
        ok: false,
        error: `Agent nedostupan: ${message}`,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
