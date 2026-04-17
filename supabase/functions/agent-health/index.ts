import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEALTH_TIMEOUT_MS = 10000;
const DEFAULT_FALLBACK_KEY = "stellan-agent-2026-v2-x7k9m2p";

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
  
  candidates.add(DEFAULT_FALLBACK_KEY);
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
  const apiKeyCandidates = getAgentApiKeyCandidates(rawAgentApiKey);

  const result = {
    ok: false,
    testedUrl: healthUrl,
    timestamp: new Date().toISOString(),
    candidatesCount: apiKeyCandidates.length,
    usedKeyMasked: "",
    durationMs: 0,
    status: 0,
    agentResponse: null as any,
    error: null as string | null,
    hint: null as string | null,
  };

  try {
    for (const [index, apiKey] of apiKeyCandidates.entries()) {
      const masked = maskApiKey(apiKey);
      console.log(`[AgentHealth] Pokušaj ${index + 1}/${apiKeyCandidates.length} | Key: ${masked} | URL: ${healthUrl}`);

      const { res, duration } = await fetchWithTimeout(
        healthUrl,
        {
          method: "GET",
          headers: {
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgentHealth/2.0",
            "Accept": "application/json",
          },
        },
        HEALTH_TIMEOUT_MS,
      );

      result.durationMs = duration;
      result.status = res.status;
      result.usedKeyMasked = masked;

      const text = await res.text();
      let parsed: any = null;

      try {
        parsed = text ? JSON.parse(text) : null;
      } catch (e) {
        parsed = { raw: text.length > 500 ? text.slice(0, 500) + "..." : text };
      }

      result.agentResponse = parsed;

      console.log(`[AgentHealth] Odgovor: ${res.status} (trajalo ${duration}ms)`);

      if (res.status === 401 || res.status === 403) {
        if (index < apiKeyCandidates.length - 1) {
          continue; // probaj sljedeći ključ
        }
        result.error = "Nevažeći API ključ (401/403)";
        result.hint = "Provjeri AGENT_API_KEY u env varijablama Supabase edge funkcije";
        break;
      }

      result.ok = res.ok;

      if (res.ok) {
        result.hint = "Agent je online i odgovara ispravno";
      } else {
        result.hint = parsed?.error || "Agent je vratio grešku";
      }

      return new Response(JSON.stringify(result), {
        status: res.ok ? 200 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ako smo ovdje, svi ključevi su pali
    result.error = "Svi API ključevi odbijeni (401/403)";
    result.hint = "Provjeri da li AGENT_API_KEY odgovara onome što agent očekuje na Cloudflare URL-u";

    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[AgentHealth] Critical error:", message);
    
    result.error = `Agent nedostupan: ${message}`;
    result.hint = "Provjeri da li Cloudflare Tunnel radi i da li je AGENT_SERVER_URL točan";

    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
