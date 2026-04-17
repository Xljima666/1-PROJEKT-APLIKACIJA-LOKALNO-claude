import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
 
const HEALTH_TIMEOUT_MS = 10000;
const FALLBACK_KEYS = ["stellan-agent-2026-v2-x7k9m2p", "promijeni-me-na-siguran-kljuc-123"];

const sanitizeAgentServerUrl = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = trimmed.match(/https?:\/\/[^\s"]+/i);
  if (!match?.[0]) return null;

  try {
    const parsed = new URL(match[0]);
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    const cleanUrl = parsed.toString().replace(/\/$/, "");
    return cleanUrl.endsWith("/health") ? cleanUrl.replace("/health", "") : cleanUrl;
  } catch {
    return null;
  }
};
 
const maskApiKey = (key: string): string => {
  if (!key || key.length < 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
};

const getAgentApiKeyCandidates = (raw: string | null): string[] => {
  const candidates = new Set<string>();
  
  if (raw) {
    const trimmed = raw.trim();
    // Direktni ključ
    if (trimmed.length > 8) candidates.add(trimmed.replace(/^[`"']+|["'`]+$/g, ""));
    
    // Iz env formata
    const envMatch = trimmed.match(/AGENT_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i);
    if (envMatch?.[1]) candidates.add(envMatch[1]);
    
    const headerMatch = trimmed.match(/X-API-Key\s*:\s*["']?([^"'\s]+)["']?/i);
    if (headerMatch?.[1]) candidates.add(headerMatch[1]);
  }
  
  for (const key of FALLBACK_KEYS) candidates.add(key);
  return Array.from(candidates);
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = HEALTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const start = Date.now();
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
        error: "AGENT_SERVER_URL nije postavljen u Supabase Edge Function env varijablama",
        hint: "Dodaj AGENT_SERVER_URL u Supabase → Edge Functions → Variables"
      }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = sanitizeAgentServerUrl(rawAgentServerUrl);
  if (!baseUrl) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: "AGENT_SERVER_URL nije validan URL",
      received: rawAgentServerUrl 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const healthUrl = `${baseUrl}/health`.replace(/\/health\/health$/, "/health");

  const result = {
    ok: false,
    testedUrl: healthUrl,
    timestamp: new Date().toISOString(),
    candidatesCount: 0,
    usedKeyMasked: "",
    durationMs: 0,
    status: 0,
    agentResponse: null as any,
    error: null as string | null,
    hint: null as string | null,
  };

  try {
    const publicAttempt = await fetchWithTimeout(
      healthUrl,
      {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "GeoTerraAgentHealth/3.0",
          Accept: "application/json",
        },
      },
      HEALTH_TIMEOUT_MS,
    );

    result.durationMs = publicAttempt.duration;
    result.status = publicAttempt.res.status;
    const publicText = await publicAttempt.res.text();
    try {
      result.agentResponse = publicText ? JSON.parse(publicText) : null;
    } catch {
      result.agentResponse = publicText ? { raw: publicText.slice(0, 500) } : null;
    }

    if (publicAttempt.res.ok) {
      result.ok = true;
      result.hint = "Agent je online i odgovara ispravno";
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKeyCandidates = getAgentApiKeyCandidates(rawAgentApiKey);
    result.candidatesCount = apiKeyCandidates.length;

    for (const apiKey of apiKeyCandidates) {
      const { res, duration } = await fetchWithTimeout(
        healthUrl,
        {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgentHealth/3.0",
            Accept: "application/json",
          },
        },
        HEALTH_TIMEOUT_MS,
      );

      result.durationMs = duration;
      result.status = res.status;
      result.usedKeyMasked = maskApiKey(apiKey);
      const text = await res.text();
      try {
        result.agentResponse = text ? JSON.parse(text) : null;
      } catch {
        result.agentResponse = text ? { raw: text.slice(0, 500) } : null;
      }

      if (res.ok) {
        result.ok = true;
        result.hint = "Agent je online i odgovara ispravno";
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    result.error = "Agent health nije prošao ni bez ključa ni s fallback ključevima";
    result.hint = "Provjeri ngrok tunel i AGENT_SERVER_URL";
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[AgentHealth] Critical error:", message);
    result.error = `Agent nedostupan: ${message}`;
    result.hint = "Provjeri da li ngrok tunel radi i da li je AGENT_SERVER_URL točan";
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
