// ============================================================
//  STELLAN — OpenAI Responses API v2
//  API endpoint  →  https://api.openai.com/v1/responses
//  Model         →  gpt-5.4-mini
//  Web search    →  built-in OpenAI web_search alat
//  Vision        →  Podržano (native multimodal input)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UPSTREAM_TIMEOUT_MS = 120000;
const MEMORY_UPDATE_TIMEOUT_MS = 25000;

// ─── OpenAI modeli ────────────────────────────────────────────
const OPENAI_MODELS: Record<string, string> = {
  "fast": "gpt-5.4-mini",
  "smart": "gpt-5.4",
  // legacy frontend vrijednosti (da ništa ne pukne dok ne promijeniš UI)
  "flash": "gpt-5.4-mini",
  "pro": "gpt-5.4",
  "flash3": "gpt-5.4-mini",
  "pro3": "gpt-5.4",
  // direct passthrough opcije
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.4": "gpt-5.4",
};
const OPENAI_DEFAULT = "fast";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MAX_OUTPUT_TOKENS = 12000;

// ─── Helper funkcije (identične) ─────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getValidAccessToken(
  supabaseAdmin: any,
  userId: string,
  table: string = "google_tokens",
): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin.from(table).select("*").eq("user_id", userId).single();
  if (!tokenRow) return null;
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 60000) return tokenRow.access_token;
  const isBrain = table === "google_brain_tokens";
  const GOOGLE_CLIENT_ID = Deno.env.get(isBrain ? "GOOGLE_BRAIN_CLIENT_ID" : "GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get(isBrain ? "GOOGLE_BRAIN_CLIENT_SECRET" : "GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from(table)
    .update({ access_token: tokens.access_token, expires_at: newExpiry })
    .eq("user_id", userId);
  return tokens.access_token;
}

async function isAdminUser(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

async function hasTokenInTable(
  supabaseAdmin: any,
  userId: string,
  table: "google_brain_tokens" | "google_tokens",
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from(table).select("id").eq("user_id", userId).limit(1);
  if (error) return false;
  return !!(data && data.length > 0);
}

async function resolveBrainOwnerId(supabaseAdmin: any, currentUserId: string): Promise<string | null> {
  const currentUserIsAdmin = await isAdminUser(supabaseAdmin, currentUserId);
  if (currentUserIsAdmin) {
    const hasCurrent =
      (await hasTokenInTable(supabaseAdmin, currentUserId, "google_brain_tokens")) ||
      (await hasTokenInTable(supabaseAdmin, currentUserId, "google_tokens"));
    if (hasCurrent) return currentUserId;
  }
  const { data: admins } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true });
  for (const admin of admins || []) {
    if (await hasTokenInTable(supabaseAdmin, admin.user_id, "google_brain_tokens")) return admin.user_id;
  }
  for (const admin of admins || []) {
    if (await hasTokenInTable(supabaseAdmin, admin.user_id, "google_tokens")) return admin.user_id;
  }
  return null;
}


// ─── Tool funkcije (identične) ───────────────────────────────

async function searchTrello(query: string): Promise<string> {
  const TRELLO_API_KEY = Deno.env.get("TRELLO_API_KEY");
  const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN");
  if (!TRELLO_API_KEY || !TRELLO_TOKEN)
    return JSON.stringify({ success: false, error: "Trello credentials not configured" });
  try {
    const params = new URLSearchParams({
      query,
      key: TRELLO_API_KEY,
      token: TRELLO_TOKEN,
      modelTypes: "cards,boards",
      cards_limit: "10",
      boards_limit: "5",
      card_fields: "name,desc,shortUrl,due,dateLastActivity,labels",
      board_fields: "name,shortUrl,desc",
      card_board: "true",
      card_list: "true",
    });
    const res = await fetchWithTimeout(
      `https://api.trello.com/1/search?${params.toString()}`,
      { method: "GET" },
      15000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Trello API error: ${res.status}` });
    const data = await res.json();
    const cards = (data.cards || []).map((c: any) => ({
      name: c.name,
      description: c.desc?.slice(0, 200) || "",
      url: c.shortUrl,
      due: c.due,
      lastActivity: c.dateLastActivity,
      labels: c.labels?.map((l: any) => l.name).filter(Boolean) || [],
      board: c.board?.name || "",
      list: c.list?.name || "",
    }));
    const boards = (data.boards || []).map((b: any) => ({
      name: b.name,
      description: b.desc?.slice(0, 200) || "",
      url: b.shortUrl,
    }));
    return JSON.stringify({ success: true, cards, boards });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function scrapeWebsite(url: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return JSON.stringify({ success: false, error: "Firecrawl API key not configured" });
  try {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://"))
      formattedUrl = `https://${formattedUrl}`;
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v1/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: formattedUrl, formats: ["markdown"], onlyMainContent: true }),
      },
      30000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Firecrawl error: ${res.status}` });
    const data = await res.json();
    const markdown = data.data?.markdown || data.markdown || "";
    const title = data.data?.metadata?.title || "";
    const trimmed = markdown.length > 8000 ? markdown.slice(0, 8000) + "\n\n... [skraćeno]" : markdown;
    return JSON.stringify({ success: true, title, content: trimmed, url: formattedUrl });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function webSearch(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query);
    // DuckDuckGo HTML search — besplatno, bez API ključa
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encoded}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
        },
      },
      20000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Search error: ${res.status}` });
    const html = await res.text();
    
    // Izvuci rezultate iz HTML-a
    const results: { title: string; url: string; description: string }[] = [];
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    
    const urls: string[] = [];
    const titles: string[] = [];
    const snippets: string[] = [];
    
    let m;
    while ((m = resultRegex.exec(html)) !== null) {
      urls.push(m[1]);
      titles.push(m[2].trim());
    }
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].trim());
    }
    
    // Ako regex nije pronašao ništa, pokušaj s drugim parserom
    if (urls.length === 0) {
      // Fallback: Brave Search API (besplatno, 2000 req/month)
      const BRAVE_KEY = Deno.env.get("BRAVE_SEARCH_API_KEY");
      if (BRAVE_KEY) {
        const braveRes = await fetchWithTimeout(
          `https://api.search.brave.com/res/v1/web/search?q=${encoded}&count=6&search_lang=hr`,
          {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": BRAVE_KEY,
            },
          },
          15000,
        );
        if (braveRes.ok) {
          const data = await braveRes.json();
          const webResults = (data.web?.results || []).slice(0, 6).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            description: r.description || "",
          }));
          return JSON.stringify({ success: true, query, results: webResults });
        }
      }
      return JSON.stringify({ success: false, error: "Pretraga nije vratila rezultate. Pokušaj ponovo." });
    }
    
    for (let i = 0; i < Math.min(urls.length, 6); i++) {
      results.push({
        title: titles[i] || "",
        url: urls[i] || "",
        description: snippets[i] || "",
      });
    }
    
    return JSON.stringify({ success: true, query, results });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

function sanitizeAgentServerUrl(raw: string): string | null {
  const match = raw.trim().match(/https?:\/\/[^\s]+/i);
  if (!match?.[0]) return null;
  try {
    const parsed = new URL(match[0]);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function sanitizeAgentApiKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const k1 = trimmed.match(/AGENT_API_KEY\s*=\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k1) return k1;
  const k2 = trimmed.match(/X-API-Key\s*:\s*["']?([^"'\s]+)["']?/i)?.[1];
  if (k2) return k2;
  return (
    trimmed
      .replace(/^[`"']+|[`"']+$/g, "")
      .split(/\s+/)[0]
      ?.trim() || null
  );
}

const FALLBACK_AGENT_API_KEY = "promijeni-me-na-siguran-kljuc-123";

function getAgentApiKeyCandidates(raw: string | null): string[] {
  const candidates = new Set<string>();
  if (raw) {
    const s = sanitizeAgentApiKey(raw);
    if (s) candidates.add(s);
  }
  candidates.add(FALLBACK_AGENT_API_KEY);
  return Array.from(candidates);
}

function sanitizeAgentPaths(body: any): any {
  if (!body || typeof body !== "object") return body;
  const prefixes = ["D:\\Stellan Brain\\", "D:\\Stellan Brain/", "D:/Stellan Brain/", "D:/Stellan Brain\\"];
  const sanitizePath = (p: string): string => {
    if (!p) return p;
    const trimmed = p.replace(/[\\/]+$/, "");
    if (trimmed.toLowerCase() === "d:\\stellan brain" || trimmed.toLowerCase() === "d:/stellan brain") return ".";
    for (const prefix of prefixes)
      if (p.toLowerCase().startsWith(prefix.toLowerCase())) return p.slice(prefix.length) || ".";
    return p;
  };
  const result = { ...body };
  if (result.path) result.path = sanitizePath(result.path);
  if (result.cwd) result.cwd = sanitizePath(result.cwd);
  if (result.repo_path) result.repo_path = sanitizePath(result.repo_path);
  if (result.filename) result.filename = sanitizePath(result.filename);
  return result;
}

async function callAgent(endpoint: string, body: any): Promise<string> {
  const AGENT_SERVER_URL = Deno.env.get("AGENT_SERVER_URL");
  const AGENT_API_KEY = Deno.env.get("AGENT_API_KEY");
  const apiKeyCandidates = getAgentApiKeyCandidates(AGENT_API_KEY || null);
  if (!AGENT_SERVER_URL) return JSON.stringify({ success: false, error: "Agent server nije konfiguriran" });
  const baseUrl = sanitizeAgentServerUrl(AGENT_SERVER_URL);
  if (!baseUrl) return JSON.stringify({ success: false, error: "Agent server URL nije valjan" });
  const sanitizedBody = sanitizeAgentPaths(body);
  try {
    const safeEndpoint = endpoint.replace(/^\/+/, "");
    const url = new URL(safeEndpoint, `${baseUrl}/`).toString();
    for (const apiKey of apiKeyCandidates) {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "GeoTerraAgent/1.0",
          },
          body: JSON.stringify(sanitizedBody),
        },
        120000,
      );
      const rawText = await res.text();
      if (res.status === 401) continue;
      if (!res.ok)
        return JSON.stringify({ success: false, error: `Agent HTTP ${res.status}: ${rawText.slice(0, 300)}` });
      try {
        return JSON.stringify(JSON.parse(rawText));
      } catch {
        return JSON.stringify({ success: false, error: `Agent vratio nevažeći odgovor: ${rawText.slice(0, 200)}` });
      }
    }
    return JSON.stringify({ success: false, error: "Agent HTTP 401: Nevažeći API ključ" });
  } catch (e) {
    return JSON.stringify({ success: false, error: `Agent nedostupan: ${String(e)}` });
  }
}

async function lookupOib(oib: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/lookup-oib`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify({ oib }),
      },
      60000,
    );
    return await res.json().then((d) => JSON.stringify(d));
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchSdge(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/search-sdge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify({ ...params, max_pages: params.max_pages || 10 }),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `SDGE error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function downloadSdgePdf(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/download-sdge-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(params),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `SDGE PDF error: ${res.status}` });
    const data = await res.json();
    if (data.pdf_base64)
      return JSON.stringify({
        success: true,
        broj_predmeta: data.broj_predmeta,
        pdf_size: data.pdf_size,
        message: `PDF za predmet ${data.broj_predmeta} uspješno preuzet (${Math.round(data.pdf_size / 1024)} KB).`,
      });
    return JSON.stringify(data);
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function sdgePovratnice(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/sdge-povratnice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "x-internal-secret": Deno.env.get("CRON_SECRET") || "",
        },
        body: JSON.stringify(params),
      },
      120000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Povratnice error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function fillZahtjev(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let cardData = params;
    if (params.card_id) {
      const { data: card } = await sb.from("cards").select("*").eq("id", params.card_id).single();
      if (card) cardData = { ...card, ...params };
    }
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    let companyData = null;
    if (adminRoles?.length) {
      const { data: company } = await sb
        .from("company_settings")
        .select("*")
        .eq("user_id", adminRoles[0].user_id)
        .single();
      companyData = company;
    }
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/fill-zahtjev`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ cardData, companyData }),
      },
      30000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Fill zahtjev error: ${res.status}` });
    return JSON.stringify({ success: true, ...(await res.json()) });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function fillPdf(params: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const body: any = {};
    if (params.pdf_url) body.pdf_url = params.pdf_url;
    if (params.pdf_base64) body.pdf_base64 = params.pdf_base64;
    if (params.list_fields_only) body.list_fields_only = true;
    if (params.field_values) body.field_values = params.field_values;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/fill-pdf`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify(body),
      },
      60000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `Fill PDF error: ${res.status}` });
    const result = await res.json();
    if (result.pdf_base64?.length > 1000)
      return JSON.stringify({
        ...result,
        pdf_base64: result.pdf_base64.substring(0, 100) + "...[TRUNCATED]",
        note: "PDF uspješno ispunjen.",
      });
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchOss(params: any): Promise<string> {
  // OSS blokira server-side requestove (Cloudflare) — koristimo Playwright agent
  const AGENT_SERVER_URL = Deno.env.get("AGENT_SERVER_URL");
  if (AGENT_SERVER_URL) {
    try {
      const agentResult = await callAgent("oss/search", params);
      const parsed = JSON.parse(agentResult);
      if (parsed.success) return agentResult;
      // Ako agent ne uspije, fallback na edge function
      console.log("[OSS] Agent failed, trying edge function:", parsed.error);
    } catch (e) {
      console.log("[OSS] Agent error, trying edge function:", e);
    }
  }

  // Fallback: direktni API (radi samo bez Cloudflare)
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/functions/v1/search-oss`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(params),
      },
      90000,
    );
    if (!res.ok) return JSON.stringify({ success: false, error: `OSS error: ${res.status}` });
    return await res.text();
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchGmail(query: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
      return JSON.stringify({ success: false, error: "Google OAuth nije konfiguriran" });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    // Resolve admin user for Gmail access
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    if (!adminRoles?.length) return JSON.stringify({ success: false, error: "Nema admin korisnika" });
    const adminId = adminRoles[0].user_id;

    const { data: tokenData } = await sb.from("google_tokens").select("*").eq("user_id", adminId).single();
    if (!tokenData) return JSON.stringify({ success: false, error: "Gmail nije povezan" });

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.expires_at) <= new Date()) {
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
      if (!refreshRes.ok) return JSON.stringify({ success: false, error: "Gmail token istekao" });
      accessToken = refreshData.access_token;
      await sb.from("google_tokens").update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
      }).eq("user_id", adminId);
    }

    const gmailQuery = encodeURIComponent(query);
    const listRes = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${gmailQuery}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      15000,
    );
    const listData = await listRes.json();
    if (!listRes.ok || !listData.messages)
      return JSON.stringify({ success: true, emails: [], total: 0, query });

    const emails = await Promise.all(
      listData.messages.slice(0, 8).map(async (msg: { id: string }) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const getH = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
        return {
          id: msg.id,
          from: getH("From"),
          to: getH("To"),
          subject: getH("Subject"),
          date: getH("Date"),
          snippet: msgData.snippet || "",
        };
      }),
    );
    return JSON.stringify({ success: true, emails, total: listData.resultSizeEstimate || emails.length, query });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchSolo(params: { tip?: string; stranica?: number; query?: string }): Promise<string> {
  const SOLO_API_TOKEN = Deno.env.get("SOLO_API_TOKEN") || Deno.env.get("SOLO_API_KEY");
  if (!SOLO_API_TOKEN) return JSON.stringify({ success: false, error: "Solo API token nije konfiguriran" });

  const query = (params.query || "").toLowerCase().trim();

  async function fetchSoloEndpoint(endpoint: string, label: string): Promise<any> {
    try {
      const urlParams = new URLSearchParams({ token: SOLO_API_TOKEN! });
      if (params.stranica) urlParams.set("stranica", String(params.stranica));
      const res = await fetchWithTimeout(
        `https://api.solo.com.hr/${endpoint}?${urlParams.toString()}`,
        { method: "GET" },
        15000,
      );
      if (!res.ok) return { success: false, error: `${label}: HTTP ${res.status}` };
      const data = await res.json();
      if (data.status !== 0) return { success: false, error: data.message || `${label} greška` };

      const items = data.racuni || data.ponude || data.nalozi ||
        (data.racun ? [data.racun] : data.ponuda ? [data.ponuda] : data.nalog ? [data.nalog] : []);

      let filtered = items;
      if (query) {
        filtered = items.filter((item: any) => {
          const searchable = [
            item.kupac_naziv, item.broj_racuna, item.broj_ponude, item.broj_naloga,
            item.napomena, item.opis, item.kupac_oib,
          ].filter(Boolean).join(" ").toLowerCase();
          return searchable.includes(query);
        });
      }

      return {
        success: true,
        tip: label,
        items: filtered.slice(0, 15).map((item: any) => ({
          id: item.id,
          broj: item.broj_racuna || item.broj_ponude || item.broj_naloga || "",
          kupac: item.kupac_naziv || "",
          oib: item.kupac_oib || "",
          datum: item.datum_racuna || item.datum_ponude || item.datum_naloga || "",
          ukupno: item.ukupno || "",
          status: item.status_racuna || item.status_ponude || item.status_naloga || "",
          fiskaliziran: item.fiskaliziran || "",
          napomena: item.napomena || item.opis || "",
        })),
        total: filtered.length,
        total_all: items.length,
      };
    } catch (e) {
      return { success: false, error: `${label}: ${String(e)}` };
    }
  }

  try {
    const tip = (params.tip || "").toLowerCase();

    // Ako je zadan specifičan tip, traži samo njega
    if (tip === "racun") return JSON.stringify(await fetchSoloEndpoint("racun", "Računi"));
    if (tip === "ponuda") return JSON.stringify(await fetchSoloEndpoint("ponuda", "Ponude"));
    if (tip === "radni_nalog" || tip === "nalog") return JSON.stringify(await fetchSoloEndpoint("radni-nalog", "Radni nalozi"));

    // Inače traži SVE tipove
    const [racuni, ponude, nalozi] = await Promise.all([
      fetchSoloEndpoint("racun", "Računi"),
      fetchSoloEndpoint("ponuda", "Ponude"),
      fetchSoloEndpoint("radni-nalog", "Radni nalozi"),
    ]);

    return JSON.stringify({
      success: true,
      racuni: racuni.success ? racuni : { error: racuni.error },
      ponude: ponude.success ? ponude : { error: ponude.error },
      radni_nalozi: nalozi.success ? nalozi : { error: nalozi.error },
      query: query || undefined,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

function driveLink(file: any): string {
  const id = file.id;
  if (!id) return "";
  if (file.mimeType === DRIVE_FOLDER_MIME) return `https://drive.google.com/drive/folders/${id}`;
  if (file.mimeType === "application/vnd.google-apps.document") return `https://docs.google.com/document/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${id}/edit`;
  if (file.mimeType === "application/vnd.google-apps.form") return `https://docs.google.com/forms/d/${id}/edit`;
  return file.webViewLink || `https://drive.google.com/file/d/${id}/view`;
}

function normalizeDriveText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function mapDriveItem(file: any) {
  return {
    id: file.id,
    name: file.name,
    type: file.mimeType,
    modified: file.modifiedTime,
    link: driveLink(file),
    isFolder: file.mimeType === DRIVE_FOLDER_MIME,
  };
}

function scoreDriveItem(file: any, normalizedQuery: string, queryTerms: string[]): number {
  const normalizedName = normalizeDriveText(file.name || "");
  let score = file.mimeType === DRIVE_FOLDER_MIME ? 100 : 0;
  if (normalizedQuery && normalizedName.includes(normalizedQuery)) score += 50;
  for (const term of queryTerms) {
    if (normalizedName.includes(term)) score += 12;
  }
  return score;
}

async function fetchDriveItems(accessToken: string, driveQuery: string, pageSize = 20): Promise<any[]> {
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,modifiedTime,webViewLink,size)&pageSize=${pageSize}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    15000,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

async function fetchDriveFolderChildren(accessToken: string, folderId: string, pageSize = 50): Promise<any[]> {
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  return fetchDriveItems(accessToken, q, pageSize);
}

async function searchGoogleDrive(accessToken: string, query: string): Promise<string> {
  try {
    const allFiles: any[] = [];
    const seenKeys = new Set<string>();
    const addFiles = (files: any[]) => {
      for (const f of files) {
        const key = f.id || f.name;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allFiles.push(f);
        }
      }
    };

    const escaped = query.replace(/'/g, "\\'");
    addFiles(await fetchDriveItems(accessToken, `fullText contains '${escaped}' and trashed=false`));
    addFiles(await fetchDriveItems(accessToken, `name contains '${escaped}' and trashed=false`));

    const normalizedQuery = normalizeDriveText(query);
    const queryTerms = normalizedQuery.split(/[\s,/-]+/).filter((w) => w.length >= 2);
    if (queryTerms.length > 1) {
      for (const kw of queryTerms.slice(0, 5)) {
        const safeKw = kw.replace(/'/g, "\\'");
        addFiles(await fetchDriveItems(accessToken, `name contains '${safeKw}' and trashed=false`));
      }
    }

    const ranked = allFiles
      .slice()
      .sort((a, b) => scoreDriveItem(b, normalizedQuery, queryTerms) - scoreDriveItem(a, normalizedQuery, queryTerms));

    const folders = ranked.filter((item) => item.mimeType === DRIVE_FOLDER_MIME).slice(0, 6);
    const foldersWithSubfolders = await Promise.all(
      folders.map(async (folder) => {
        const children = await fetchDriveFolderChildren(accessToken, folder.id, 50);
        const subfolders = children
          .filter((child) => child.mimeType === DRIVE_FOLDER_MIME)
          .map(mapDriveItem)
          .sort((a, b) => a.name.localeCompare(b.name, "hr"));

        return {
          ...mapDriveItem(folder),
          subfolders,
        };
      }),
    );

    const files = foldersWithSubfolders.length === 0
      ? ranked.filter((item) => item.mimeType !== DRIVE_FOLDER_MIME).slice(0, 10).map(mapDriveItem)
      : [];

    return JSON.stringify({
      success: true,
      query,
      folders: foldersWithSubfolders,
      files,
      totalFolders: foldersWithSubfolders.length,
      totalFiles: files.length,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function listDriveFolder(accessToken: string, folderId: string): Promise<string> {
  try {
    const items = (await fetchDriveFolderChildren(accessToken, folderId, 50)).map((f: any) => ({
      ...mapDriveItem(f),
      size: f.size ? parseInt(f.size) : null,
    }));
    return JSON.stringify({ success: true, items, total: items.length, folderId });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchGeoterraApp(query: string): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w.length >= 2);
    const terms = words.length > 0 ? words : [q];
    const orConds = terms.flatMap((t) => [
      `title.ilike.%${t}%`,
      `description.ilike.%${t}%`,
      `narucitelj_ime.ilike.%${t}%`,
      `katastarska_opcina.ilike.%${t}%`,
      `katastarska_cestica.ilike.%${t}%`,
      `adresa_cestice.ilike.%${t}%`,
      `narucitelj_oib.ilike.%${t}%`,
      `kontakt.ilike.%${t}%`,
    ]);
    const { data: cards } = await sb
      .from("cards")
      .select(
        "id, title, description, status, narucitelj_ime, narucitelj_oib, kontakt, katastarska_opcina, katastarska_cestica, adresa_cestice, vrsta_posla, due_date, column_id, created_at",
      )
      .or(orConds.join(","))
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: boards } = await sb
      .from("boards")
      .select("id, title, description, created_at")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    const columnIds = [...new Set((cards || []).map((c: any) => c.column_id))];
    let columnMap: Record<string, any> = {};
    if (columnIds.length > 0) {
      const { data: cols } = await sb.from("columns").select("id, title, board_id").in("id", columnIds);
      for (const col of cols || []) columnMap[col.id] = { title: col.title, board_id: col.board_id };
    }
    const boardIds = [...new Set(Object.values(columnMap).map((c: any) => c.board_id))];
    let boardMap: Record<string, string> = {};
    if (boardIds.length > 0) {
      const { data: bds } = await sb.from("boards").select("id, title").in("id", boardIds);
      for (const b of bds || []) boardMap[b.id] = b.title;
    }
    const enrichedCards = (cards || []).map((c: any) => {
      const col = columnMap[c.column_id];
      return {
        id: c.id,
        title: c.title,
        description: c.description?.slice(0, 200) || "",
        status: c.status,
        narucitelj: c.narucitelj_ime,
        kat_opcina: c.katastarska_opcina,
        kat_cestica: c.katastarska_cestica,
        adresa: c.adresa_cestice,
        vrsta_posla: c.vrsta_posla,
        due_date: c.due_date,
        board: col ? boardMap[col.board_id] || "" : "",
        column: col?.title || "",
      };
    });
    return JSON.stringify({
      success: true,
      cards: enrichedCards,
      boards: (boards || []).map((b: any) => ({ id: b.id, title: b.title, description: b.description?.slice(0, 200) })),
      total_cards: enrichedCards.length,
      total_boards: (boards || []).length,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function updateGeoterraCard(args: any): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { card_id, ...updates } = args;
    if (!card_id) return JSON.stringify({ success: false, error: "card_id is required" });
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined && v !== null) cleanUpdates[k] = v;
    if (Object.keys(cleanUpdates).length === 0) return JSON.stringify({ success: false, error: "No fields to update" });
    cleanUpdates.updated_at = new Date().toISOString();
    const { data, error } = await sb
      .from("cards")
      .update(cleanUpdates)
      .eq("id", card_id)
      .select("id, title, status")
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, card: data });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// Drive tools
async function getFolderIdByName(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${folderName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()).files?.[0]?.id || null;
}

async function findItemInFolder(accessToken: string, parentFolderId: string, itemName: string): Promise<any | null> {
  const q = encodeURIComponent(
    `name='${itemName.replace(/'/g, "\\'")}' and '${parentFolderId}' in parents and trashed=false`,
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,webViewLink)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  return (await res.json()).files?.[0] || null;
}


function inferTextMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".xml") || lower.endsWith(".gml") || lower.endsWith(".kml")) return "application/xml";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/typescript";
  if (lower.endsWith(".tsx")) return "text/plain";
  if (lower.endsWith(".jsx")) return "text/plain";
  if (lower.endsWith(".py")) return "text/x-python";
  if (lower.endsWith(".sql")) return "application/sql";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "application/yaml";
  return "text/plain; charset=UTF-8";
}

async function uploadFileToBrain(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  content: string,
): Promise<boolean> {
  try {
    const existing = await findItemInFolder(accessToken, parentFolderId, fileName);
    const metadata = {
      name: fileName,
      parents: [parentFolderId],
      mimeType: inferTextMimeType(fileName),
    };

    const boundary = "stellan_upload_" + crypto.randomUUID().replace(/-/g, "");
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${metadata.mimeType}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const url = existing?.id
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,webViewLink`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";

    const method = existing?.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    return res.ok;
  } catch {
    return false;
  }
}

async function findFileInBrain(
  accessToken: string,
  brainFolderId: string,
  fileName: string,
  subfolderName?: string,
): Promise<{ fileId: string; file: any } | null> {
  try {
    let parentFolderId = brainFolderId;

    if (subfolderName) {
      const subfolderId = await getFolderIdByName(accessToken, brainFolderId, subfolderName);
      if (!subfolderId) return null;
      parentFolderId = subfolderId;
    }

    const file = await findItemInFolder(accessToken, parentFolderId, fileName);
    if (!file?.id) return null;

    return { fileId: file.id, file };
  } catch {
    return null;
  }
}

async function downloadFileContent(
  accessToken: string,
  fileInfo: { id: string; name?: string; mimeType?: string },
): Promise<string | null> {
  try {
    let url = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media`;

    if (fileInfo.mimeType === "application/vnd.google-apps.document") {
      url = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}/export?mimeType=${encodeURIComponent("text/plain")}`;
    } else if (fileInfo.mimeType === "application/vnd.google-apps.spreadsheet") {
      url = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}/export?mimeType=${encodeURIComponent("text/csv")}`;
    } else if (fileInfo.mimeType === "application/vnd.google-apps.presentation") {
      url = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}/export?mimeType=${encodeURIComponent("text/plain")}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 300000 ? text.slice(0, 300000) + "\n...[skraćeno]" : text;
  } catch {
    return null;
  }
}


async function executeDriveTool(
  accessToken: string,
  brainFolderId: string,
  toolName: string,
  args: any,
): Promise<string> {
  switch (toolName) {
    case "create_drive_folder": {
      const q = encodeURIComponent(
        `name='${args.folder_name}' and '${brainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      );
      const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (sr.ok) {
        const sd = await sr.json();
        if (sd.files?.length > 0)
          return JSON.stringify({
            success: true,
            action: "existing",
            folder_id: sd.files[0].id,
            name: args.folder_name,
          });
      }
      const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.folder_name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [brainFolderId],
        }),
      });
      if (!cr.ok) return JSON.stringify({ success: false, error: `Create folder failed: ${cr.status}` });
      const folder = await cr.json();
      return JSON.stringify({
        success: true,
        action: "created",
        folder_id: folder.id,
        name: args.folder_name,
        link: folder.webViewLink,
      });
    }
    case "create_drive_file": {
      let targetFolderId = brainFolderId;
      if (args.subfolder_name) {
        const r = JSON.parse(
          await executeDriveTool(accessToken, brainFolderId, "create_drive_folder", {
            folder_name: args.subfolder_name,
          }),
        );
        if (!r.success) return JSON.stringify({ success: false, error: `Subfolder error: ${r.error}` });
        targetFolderId = r.folder_id;
      }
      const ok = await uploadFileToBrain(accessToken, targetFolderId, args.file_name, args.content);
      return JSON.stringify(
        ok
          ? { success: true, file_name: args.file_name, folder_id: targetFolderId }
          : { success: false, error: "Upload failed" },
      );
    }
    case "list_drive_files": {
      const q = encodeURIComponent(`'${brainFolderId}' in parents and trashed=false`);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,webViewLink,parents)&pageSize=50&orderBy=name`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return JSON.stringify({ success: false, error: `API error: ${res.status}` });
      return JSON.stringify({ success: true, files: (await res.json()).files || [] });
    }
    case "read_brain_file": {
      const found = await findFileInBrain(accessToken, brainFolderId, args.file_name, args.subfolder_name);
      if (!found) return JSON.stringify({ success: false, error: `Datoteka '${args.file_name}' nije pronađena` });
      const text = await downloadFileContent(accessToken, {
        id: found.fileId,
        name: args.file_name,
        mimeType: found.file?.mimeType,
      });
      if (!text) return JSON.stringify({ success: false, error: `Nije moguće pročitati '${args.file_name}'` });
      return JSON.stringify({
        success: true,
        file_name: args.file_name,
        content: text,
        chars: text.length,
      });
    }
    case "rename_drive_item": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId)
        return JSON.stringify({ success: false, error: `Folder '${args.source_folder_name}' nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.current_name);
      if (!item) return JSON.stringify({ success: false, error: `Stavka '${args.current_name}' nije pronađena` });
      const pr = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?fields=id,name,webViewLink`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.new_name }),
      });
      if (!pr.ok) return JSON.stringify({ success: false, error: `Rename failed: ${pr.status}` });
      const updated = await pr.json();
      return JSON.stringify({ success: true, action: "renamed", old_name: args.current_name, new_name: updated.name });
    }
    case "move_drive_item": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId) return JSON.stringify({ success: false, error: `Izvorni folder nije pronađen` });
      const targetFolderId =
        !args.target_folder_name || args.target_folder_name.toLowerCase() === "root"
          ? brainFolderId
          : await getFolderIdByName(accessToken, brainFolderId, args.target_folder_name);
      if (!targetFolderId)
        return JSON.stringify({ success: false, error: `Ciljni folder '${args.target_folder_name}' nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.item_name);
      if (!item) return JSON.stringify({ success: false, error: `Stavka '${args.item_name}' nije pronađena` });
      const removeParents = Array.isArray(item.parents) ? item.parents.join(",") : sourceFolderId;
      const mr = await fetch(
        `https://www.googleapis.com/drive/v3/files/${item.id}?addParents=${encodeURIComponent(targetFolderId)}&removeParents=${encodeURIComponent(removeParents)}&fields=id,name`,
        { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!mr.ok) return JSON.stringify({ success: false, error: `Move failed: ${mr.status}` });
      return JSON.stringify({
        success: true,
        action: "moved",
        name: args.item_name,
        to_folder: args.target_folder_name,
      });
    }
    case "copy_drive_file": {
      const sourceFolderId = args.source_folder_name
        ? await getFolderIdByName(accessToken, brainFolderId, args.source_folder_name)
        : brainFolderId;
      if (!sourceFolderId) return JSON.stringify({ success: false, error: "Izvorni folder nije pronađen" });
      const targetFolderId = await getFolderIdByName(accessToken, brainFolderId, args.target_folder_name);
      if (!targetFolderId) return JSON.stringify({ success: false, error: `Ciljni folder nije pronađen` });
      const item = await findItemInFolder(accessToken, sourceFolderId, args.file_name);
      if (!item) return JSON.stringify({ success: false, error: `Datoteka '${args.file_name}' nije pronađena` });
      const cr = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}/copy?fields=id,name,webViewLink`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: args.new_file_name || args.file_name, parents: [targetFolderId] }),
      });
      if (!cr.ok) return JSON.stringify({ success: false, error: `Copy failed: ${cr.status}` });
      const copied = await cr.json();
      return JSON.stringify({
        success: true,
        action: "copied",
        new_name: copied.name,
        to_folder: args.target_folder_name,
      });
    }
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}

function shouldEnableDriveTools(messages: any[]): boolean {
  const lastMsg =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content;
  const text = typeof lastMsg === "string" ? lastMsg.toLowerCase() : "";
  return [
    "spremi", "snimi", "datotek", "file", "folder", "map", "drive",
    "izlist", "lista", "dokument", "napravi fajl", "kreiraj",
    "preimenuj", "rename", "premjesti", "move", "kopiraj", "copy",
    "pročitaj", "procitaj", "read", "memory.md", "upute.md",
    "projekti.md", "cijeli kod", "cijeli sadržaj", "sadržaj datoteke",
  ].some((kw) => text.includes(kw));
}

// ─────────────────────────────────────────────────────────────
//  OPENAI TOOL DEFINITIONS (function calling format)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  STELLAN SELF-AWARENESS — dynamic tools, knowledge, DB inspect
// ─────────────────────────────────────────────────────────────

async function loadStellanKnowledge(supabaseAdmin: any): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("stellan_knowledge")
      .select("title, category")
      .order("category");
    if (!data?.length) return "";
    // Samo indeks znanja — puni sadržaj se dohvaća kroz search_knowledge tool
    const byCategory: Record<string, string[]> = {};
    for (const k of data) {
      const cat = k.category || "general";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(k.title);
    }
    let out = "Imaš spremljeno znanje o ovim temama (koristi search_knowledge za detalje):\n";
    for (const [cat, titles] of Object.entries(byCategory)) {
      out += `- **${cat}**: ${titles.join(", ")}\n`;
    }
    return out;
  } catch { return ""; }
}

async function loadStellanToolsRegistry(supabaseAdmin: any): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("stellan_tools")
      .select("name, description, category, enabled")
      .eq("auto_load", true)
      .order("category");
    if (!data?.length) return "";
    const byCategory: Record<string, any[]> = {};
    for (const t of data) {
      const cat = t.category || "general";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    }
    let out = "";
    for (const [cat, tools] of Object.entries(byCategory)) {
      out += `\n### ${cat.toUpperCase()}\n`;
      for (const t of tools) {
        out += `- ${t.name} ${t.enabled ? "" : "(DISABLED)"} — ${t.description}\n`;
      }
    }
    return out;
  } catch { return ""; }
}

async function dbInspect(supabaseAdmin: any, args: any): Promise<string> {
  try {
    const table = args.table || "";
    if (!table) {
      return JSON.stringify({ success: true, tables: [
        "Profiles","activity_log","archived_boards","archived_cards","archived_columns",
        "attachments","boards","calendar_events","card_labels","cards","chat_conversations",
        "chat_messages","columns","comments","company_settings","contact_submissions",
        "google_brain_tokens","google_tokens","invitations","invoice_items","invoices",
        "labels","oauth_nonces","profiles","push_subscriptions","quote_items","quotes",
        "sdge_notifications","stellan_memory","stellan_tools","stellan_knowledge",
        "token_usage","user_api_keys","user_roles","user_tab_permissions",
        "work_order_items","work_orders","workspace_items"
      ]});
    }
    // Inspect specific table — get first 3 rows to see structure
    const { data: sample, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .limit(3);
    if (error) return JSON.stringify({ success: false, error: error.message });
    const columns = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
    const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    return JSON.stringify({
      success: true,
      table,
      columns,
      row_count: count,
      sample: sample?.map((row: any) => {
        const cleaned: any = {};
        for (const [k, v] of Object.entries(row)) {
          const val = typeof v === "string" && v.length > 200 ? v.substring(0, 200) + "..." : v;
          cleaned[k] = val;
        }
        return cleaned;
      }),
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function registerTool(supabaseAdmin: any, args: any): Promise<string> {
  try {
    const { name, description, category, edge_function, parameters } = args;
    if (!name || !description) {
      return JSON.stringify({ success: false, error: "name i description su obavezni" });
    }
    const { data, error } = await supabaseAdmin
      .from("stellan_tools")
      .upsert({
        name,
        description,
        category: category || "custom",
        edge_function: edge_function || null,
        parameters: parameters || {},
        enabled: true,
        auto_load: true,
        created_by: "stellan",
        updated_at: new Date().toISOString(),
      }, { onConflict: "name" })
      .select()
      .single();
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, message: `Tool '${name}' registriran.`, tool: data });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function saveKnowledge(supabaseAdmin: any, args: any): Promise<string> {
  try {
    const { title, content, category, tags } = args;
    if (!title || !content) {
      return JSON.stringify({ success: false, error: "title i content su obavezni" });
    }
    // Upsert by title
    const { data: existing } = await supabaseAdmin
      .from("stellan_knowledge")
      .select("id")
      .eq("title", title)
      .limit(1);
    
    if (existing && existing.length > 0) {
      const { error } = await supabaseAdmin
        .from("stellan_knowledge")
        .update({
          content,
          category: category || "general",
          tags: tags || [],
          created_by: "stellan",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
      if (error) return JSON.stringify({ success: false, error: error.message });
      return JSON.stringify({ success: true, message: `Znanje '${title}' ažurirano.`, action: "updated" });
    }

    const { error } = await supabaseAdmin
      .from("stellan_knowledge")
      .insert({
        title,
        content,
        category: category || "general",
        tags: tags || [],
        created_by: "stellan",
      });
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, message: `Znanje '${title}' spremljeno.`, action: "created" });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function searchKnowledge(supabaseAdmin: any, query: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("stellan_knowledge")
      .select("title, category, content, tags")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%,category.ilike.%${query}%`)
      .limit(5);
    if (!data?.length) return JSON.stringify({ success: true, results: [], message: "Nema rezultata." });
    return JSON.stringify({ success: true, results: data.map((k: any) => ({ title: k.title, category: k.category, content: k.content.substring(0, 500) + (k.content.length > 500 ? "..." : ""), tags: k.tags })) });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

async function dbQuery(supabaseAdmin: any, args: any): Promise<string> {
  try {
    const { table, select, filter, limit: rowLimit } = args;
    if (!table) return JSON.stringify({ success: false, error: "table je obavezan" });
    let query = supabaseAdmin.from(table).select(select || "*");
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        query = query.eq(key, value);
      }
    }
    query = query.limit(rowLimit || 20);
    const { data, error } = await query;
    if (error) return JSON.stringify({ success: false, error: error.message });
    return JSON.stringify({ success: true, table, count: data?.length || 0, data });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ─────────────────────────────────────────────────────────────
//  GENERATE FILE — spremi datoteku u Storage za download
// ─────────────────────────────────────────────────────────────

async function generateFile(supabaseAdmin: any, userId: string, args: any): Promise<string> {
  try {
    const { filename, content, content_type } = args;
    if (!filename || !content) {
      return JSON.stringify({ success: false, error: "filename i content su obavezni" });
    }
    // Reject placeholder/description content for code files
    const codeExts = [".ts",".tsx",".js",".jsx",".py",".html",".css",".json",".sql",".sh",".bat"];
    const isCodeFile = codeExts.some(ext => filename.toLowerCase().endsWith(ext));
    if (isCodeFile && content.length < 100 && (content.startsWith("[") || content.startsWith("(") || content.includes("kompletan") || content.includes("cijela datoteka"))) {
      return JSON.stringify({ success: false, error: `GREŠKA: content sadrži OPIS datoteke umjesto STVARNOG KODA. Moraš napisati KOMPLETNI izvorni kod za ${filename}, ne opisivati što bi trebalo biti unutra. Napiši svaki red koda.` });
    }
    const mime = content_type || (
      filename.endsWith(".lsp") ? "text/plain" :
      filename.endsWith(".gml") ? "application/gml+xml" :
      filename.endsWith(".geojson") ? "application/geo+json" :
      filename.endsWith(".kml") ? "application/vnd.google-earth.kml+xml" :
      filename.endsWith(".csv") ? "text/csv" :
      filename.endsWith(".json") ? "application/json" :
      filename.endsWith(".xml") ? "application/xml" :
      filename.endsWith(".txt") ? "text/plain" :
      "application/octet-stream"
    );
    const path = `files/${userId}/${Date.now()}_${filename}`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    const { data, error } = await supabaseAdmin.storage
      .from("screenshots")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (error) return JSON.stringify({ success: false, error: error.message });
    const { data: urlData } = supabaseAdmin.storage.from("screenshots").getPublicUrl(path);
    const url = urlData?.publicUrl || "";
    return JSON.stringify({
      success: true,
      filename,
      url,
      size: bytes.length,
      message: `Datoteka '${filename}' spremljena (${(bytes.length / 1024).toFixed(1)} KB).`,
      _instruction: "Download gumb je automatski prikazan korisniku. NE piši link ni URL u odgovoru.",
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ─────────────────────────────────────────────────────────────
//  GENERATE ZIP — spakuj više datoteka u ZIP za download
// ─────────────────────────────────────────────────────────────

async function generateZip(supabaseAdmin: any, userId: string, args: any): Promise<string> {
  try {
    const { zip_filename, files } = args;
    if (!zip_filename || !files || !Array.isArray(files) || files.length === 0) {
      return JSON.stringify({ success: false, error: "zip_filename i files (array) su obavezni" });
    }

    const zipData: Record<string, Uint8Array> = {};
    const codeExts = [".ts",".tsx",".js",".jsx",".py",".html",".css",".json",".sql",".sh",".bat"];
    for (const f of files) {
      if (f.filename && f.content) {
        const isCodeFile = codeExts.some(ext => f.filename.toLowerCase().endsWith(ext));
        if (isCodeFile && f.content.length < 100 && (f.content.startsWith("[") || f.content.startsWith("(") || f.content.includes("kompletan") || f.content.includes("cijela"))) {
          return JSON.stringify({ success: false, error: `GREŠKA: Datoteka '${f.filename}' sadrži OPIS umjesto STVARNOG KODA. content mora biti KOMPLETNI izvorni kod — svaki import, svaka funkcija, svaki export. Ne opisuj kod, NAPIŠI ga.` });
        }
        zipData[f.filename] = strToU8(f.content);
      }
    }

    if (Object.keys(zipData).length === 0) {
      return JSON.stringify({ success: false, error: "Nema validnih datoteka za zip" });
    }

    const zipped = zipSync(zipData, { level: 6 });
    const path = `files/${userId}/${Date.now()}_${zip_filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from("screenshots")
      .upload(path, zipped, { contentType: "application/zip", upsert: true });

    if (error) return JSON.stringify({ success: false, error: error.message });

    const { data: urlData } = supabaseAdmin.storage.from("screenshots").getPublicUrl(path);
    const url = urlData?.publicUrl || "";

    return JSON.stringify({
      success: true,
      filename: zip_filename,
      url,
      size: zipped.length,
      file_count: Object.keys(zipData).length,
      message: `ZIP '${zip_filename}' (${Object.keys(zipData).length} datoteka, ${(zipped.length / 1024).toFixed(1)} KB).`,
      _instruction: "Download gumb je automatski prikazan korisniku. NE piši link ni URL u odgovoru.",
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ─────────────────────────────────────────────────────────────
//  PARSE GML — izvuci podatke iz GML stringa
// ─────────────────────────────────────────────────────────────

function parseGml(args: any): string {
  try {
    const gml = args.gml_content || "";
    if (!gml) return JSON.stringify({ success: false, error: "gml_content je obavezan" });

    const parcels: any[] = [];
    const points: any[] = [];

    // Izvuci čestice
    const parcelRegex = /<(?:\w+:)?KatastarskaCestica[^>]*gml:id="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?KatastarskaCestica>/g;
    let pm;
    while ((pm = parcelRegex.exec(gml)) !== null) {
      const block = pm[2];
      const num = block.match(/<(?:\w+:)?brojCestice>([^<]+)/)?.[1] || "";
      const area = block.match(/<(?:\w+:)?povrsina>([^<]+)/)?.[1] || "";
      const koId = block.match(/<(?:\w+:)?katOpcinaId>([^<]+)/)?.[1] || "";

      // Izvuci koordinate iz posList
      const posListMatch = block.match(/<gml:posList[^>]*>([^<]+)/);
      let coords: number[][] = [];
      if (posListMatch) {
        const nums = posListMatch[1].trim().split(/\s+/).map(Number);
        for (let i = 0; i < nums.length - 1; i += 2) {
          coords.push([nums[i], nums[i + 1]]);
        }
      }

      parcels.push({
        id: pm[1],
        brojCestice: num,
        povrsina: area ? parseFloat(area) : null,
        katOpcinaId: koId,
        coordinates: coords,
        numPoints: coords.length,
      });
    }

    // Izvuci točke (MedjasnaTocka)
    const pointRegex = /<(?:\w+:)?MedjasnaTocka[^>]*>([\s\S]*?)<\/(?:\w+:)?MedjasnaTocka>/g;
    let ptm;
    while ((ptm = pointRegex.exec(gml)) !== null) {
      const block = ptm[1];
      const posMatch = block.match(/<gml:pos[^>]*>([^<]+)/);
      if (posMatch) {
        const [e, n] = posMatch[1].trim().split(/\s+/).map(Number);
        const id = block.match(/gml:id="([^"]*)"/)?.[1] || "";
        const br = block.match(/<(?:\w+:)?brojTocke>([^<]+)/)?.[1] || "";
        points.push({ id, brojTocke: br, easting: e, northing: n });
      }
    }

    // Izvuci srsName
    const srsMatch = gml.match(/srsName="([^"]+)"/);
    const srs = srsMatch ? srsMatch[1] : "nepoznat";

    return JSON.stringify({
      success: true,
      srs,
      parcels,
      points,
      total_parcels: parcels.length,
      total_points: points.length,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ─────────────────────────────────────────────────────────────
//  GENERATE GML — generiraj GML iz podataka
// ─────────────────────────────────────────────────────────────

function generateGml(args: any): string {
  try {
    const { parcels, srs = "EPSG:3765", ko_id = "" } = args;
    if (!parcels || !Array.isArray(parcels) || parcels.length === 0) {
      return JSON.stringify({ success: false, error: "parcels je obavezan (array s coordinates)" });
    }

    let gml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    gml += `<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2"\n`;
    gml += `    xmlns:hr="http://www.dgu.hr/schemas/elaborate">\n`;

    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      const coords = p.coordinates || [];
      const num = p.brojCestice || p.number || `${i + 1}`;
      const area = p.povrsina || p.area || 0;
      const koIdVal = p.katOpcinaId || ko_id;

      gml += `  <gml:featureMember>\n`;
      gml += `    <hr:KatastarskaCestica gml:id="cestica.${i + 1}">\n`;
      gml += `      <hr:brojCestice>${num}</hr:brojCestice>\n`;
      if (koIdVal) gml += `      <hr:katOpcinaId>${koIdVal}</hr:katOpcinaId>\n`;
      if (area) gml += `      <hr:povrsina>${area}</hr:povrsina>\n`;

      if (coords.length > 0) {
        gml += `      <hr:geometrija>\n`;
        gml += `        <gml:Polygon srsName="${srs}">\n`;
        gml += `          <gml:exterior>\n`;
        gml += `            <gml:LinearRing>\n`;
        gml += `              <gml:posList>\n`;

        const posCoords = coords.map((c: number[]) => `                ${c[0]} ${c[1]}`).join("\n");
        gml += posCoords + "\n";

        // Zatvori poligon ako nije zatvoren
        if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
          gml += `                ${coords[0][0]} ${coords[0][1]}\n`;
        }

        gml += `              </gml:posList>\n`;
        gml += `            </gml:LinearRing>\n`;
        gml += `          </gml:exterior>\n`;
        gml += `        </gml:Polygon>\n`;
        gml += `      </hr:geometrija>\n`;
      }

      gml += `    </hr:KatastarskaCestica>\n`;
      gml += `  </gml:featureMember>\n`;
    }

    gml += `</gml:FeatureCollection>\n`;

    return JSON.stringify({
      success: true,
      gml_content: gml,
      parcels_count: parcels.length,
      srs,
      message: `GML generiran s ${parcels.length} čestica u ${srs}`,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

// ─────────────────────────────────────────────────────────────
//  CONVERT COORDINATES — WGS84 ↔ HTRS96/TM (EPSG:3765)
// ─────────────────────────────────────────────────────────────

function convertCoordinates(args: any): string {
  try {
    const { coordinates, from_srs, to_srs } = args;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return JSON.stringify({ success: false, error: "coordinates je obavezan (array of [x, y] ili [lon, lat])" });
    }
    const fromSrs = (from_srs || "").toUpperCase();
    const toSrs = (to_srs || "").toUpperCase();

    if (!fromSrs || !toSrs) {
      return JSON.stringify({ success: false, error: "from_srs i to_srs su obavezni (npr. 'WGS84' ili 'HTRS96')" });
    }

    // GRS80 ellipsoid parameters (used by HTRS96)
    const a = 6378137.0;
    const f = 1 / 298.257222101;
    const b = a * (1 - f);
    const e2 = (a * a - b * b) / (a * a);
    const e_prime2 = (a * a - b * b) / (b * b);

    // HTRS96/TM parameters (EPSG:3765)
    const lon0 = 16.5 * Math.PI / 180; // central meridian 16.5°
    const k0 = 0.9999;
    const FE = 500000; // false easting
    const FN = 0; // false northing

    function degToRad(d: number) { return d * Math.PI / 180; }
    function radToDeg(r: number) { return r * 180 / Math.PI; }

    // WGS84 → HTRS96/TM
    function toTM(lon: number, lat: number): [number, number] {
      const phi = degToRad(lat);
      const lambda = degToRad(lon);
      const dLambda = lambda - lon0;

      const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
      const T = Math.tan(phi) * Math.tan(phi);
      const C = e_prime2 * Math.cos(phi) * Math.cos(phi);
      const A = Math.cos(phi) * dLambda;

      // Meridian arc
      const e4 = e2 * e2;
      const e6 = e4 * e2;
      const M = a * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
        + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
        - (35 * e6 / 3072) * Math.sin(6 * phi)
      );

      const easting = FE + k0 * N * (
        A + (1 - T + C) * A * A * A / 6
        + (5 - 18 * T + T * T + 72 * C - 58 * e_prime2) * A * A * A * A * A / 120
      );

      const northing = FN + k0 * (
        M + N * Math.tan(phi) * (
          A * A / 2
          + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
          + (61 - 58 * T + T * T + 600 * C - 330 * e_prime2) * A * A * A * A * A * A / 720
        )
      );

      return [Math.round(easting * 100) / 100, Math.round(northing * 100) / 100];
    }

    // HTRS96/TM → WGS84
    function fromTM(easting: number, northing: number): [number, number] {
      const x = easting - FE;
      const y = northing - FN;

      const M0 = y / k0;
      const mu = M0 / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

      const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
      const phi1 = mu
        + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
        + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

      const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
      const T1 = Math.tan(phi1) * Math.tan(phi1);
      const C1 = e_prime2 * Math.cos(phi1) * Math.cos(phi1);
      const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
      const D = x / (N1 * k0);

      const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
        D * D / 2
        - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e_prime2) * D * D * D * D / 24
        + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e_prime2 - 3 * C1 * C1) * D * D * D * D * D * D / 720
      );

      const lon = lon0 + (
        D - (1 + 2 * T1 + C1) * D * D * D / 6
        + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e_prime2 + 24 * T1 * T1) * D * D * D * D * D / 120
      ) / Math.cos(phi1);

      return [
        Math.round(radToDeg(lon) * 1000000) / 1000000,
        Math.round(radToDeg(lat) * 1000000) / 1000000,
      ];
    }

    const converted: any[] = [];
    const isToTM = (fromSrs.includes("WGS") || fromSrs.includes("4326")) && (toSrs.includes("HTRS") || toSrs.includes("3765"));
    const isFromTM = (fromSrs.includes("HTRS") || fromSrs.includes("3765")) && (toSrs.includes("WGS") || toSrs.includes("4326"));

    if (!isToTM && !isFromTM) {
      return JSON.stringify({
        success: false,
        error: `Konverzija ${fromSrs} → ${toSrs} nije podržana. Podržano: WGS84/EPSG:4326 ↔ HTRS96/EPSG:3765`,
      });
    }

    for (const coord of coordinates) {
      const [x, y] = Array.isArray(coord) ? coord : [coord.x || coord.lon || coord.easting, coord.y || coord.lat || coord.northing];
      if (isToTM) {
        const [e, n] = toTM(x, y);
        converted.push({ input: { lon: x, lat: y }, output: { easting: e, northing: n } });
      } else {
        const [lon, lat] = fromTM(x, y);
        converted.push({ input: { easting: x, northing: y }, output: { lon, lat } });
      }
    }

    return JSON.stringify({
      success: true,
      from: fromSrs,
      to: toSrs,
      count: converted.length,
      converted,
      message: `Konvertirano ${converted.length} točaka iz ${fromSrs} u ${toSrs}`,
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}

function buildTools(opts: {
  enableDriveTools: boolean;
  hasTrello: boolean;
  hasFirecrawl: boolean;
  hasGeoterraDrive: boolean;
  hasAgent: boolean;
}) {
  const tools: any[] = [];

  const fn = (name: string, description: string, parameters: any) => ({
    type: "function",
    function: { name, description, parameters },
  });

  if (opts.enableDriveTools) {
    tools.push(
      fn("create_drive_folder", "Stvori novi folder u Stellan Brain folderu.", {
        type: "object",
        properties: { folder_name: { type: "string", description: "Ime foldera" } },
        required: ["folder_name"],
      }),
      fn("create_drive_file", "Stvori ili ažuriraj datoteku u Stellan Brain folderu.", {
        type: "object",
        properties: {
          file_name: { type: "string" },
          content: { type: "string" },
          subfolder_name: { type: "string" },
        },
        required: ["file_name", "content"],
      }),
      fn("list_drive_files", "Izlistaj datoteke u Stellan Brain folderu.", {
        type: "object",
        properties: {},
      }),
      fn("read_brain_file", "Pročitaj CIJELI sadržaj datoteke iz Stellan Brain foldera (bez skraćivanja). OBAVEZNO koristi kad korisnik traži da pročitaš memory.md, upute.md ili bilo koju drugu datoteku.", {
        type: "object",
        properties: { file_name: { type: "string" }, subfolder_name: { type: "string" } },
        required: ["file_name"],
      }),
      fn("rename_drive_item", "Preimenuj datoteku ili folder u Stellan Brain folderu.", {
        type: "object",
        properties: {
          current_name: { type: "string" },
          new_name: { type: "string" },
          source_folder_name: { type: "string" },
        },
        required: ["current_name", "new_name"],
      }),
      fn("move_drive_item", "Premjesti datoteku ili folder u Stellan Brain folderu.", {
        type: "object",
        properties: {
          item_name: { type: "string" },
          target_folder_name: { type: "string" },
          source_folder_name: { type: "string" },
        },
        required: ["item_name", "target_folder_name"],
      }),
      fn("copy_drive_file", "Kopiraj datoteku unutar Stellan Brain foldera.", {
        type: "object",
        properties: {
          file_name: { type: "string" },
          target_folder_name: { type: "string" },
          source_folder_name: { type: "string" },
          new_file_name: { type: "string" },
        },
        required: ["file_name", "target_folder_name"],
      }),
    );
  }

  if (opts.hasTrello)
    tools.push(fn("search_trello", "Pretraži Trello ploče i kartice.", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }));

  // Internet je sada built-in preko OpenAI Responses web_search alata.
  // Ali za Grok/Claude/Gemini trebamo eksplicitni tool:
  tools.push(fn("search_internet", "Pretraži internet/web za informacije, novosti, proizvode, cijene, dokumentaciju, tutoriale, i bilo što drugo. UVIJEK koristi kad korisnik pita o nečemu što nije u internim izvorima (SDGE, Trello, Drive). Koristi za: novosti, proizvode, tehnologije, cijene, vremenske prognoze, sportske rezultate, općenito znanje.", {
    type: "object",
    properties: {
      query: { type: "string", description: "Pojam za pretragu na internetu (na engleskom ili hrvatskom)" },
    },
    required: ["query"],
  }));

  if (opts.hasFirecrawl)
    tools.push(fn("scrape_website", "Dohvati sadržaj web stranice po URL-u.", {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    }));
  if (opts.hasGeoterraDrive) {
    tools.push(fn("search_drive", "Pretraži Google Drive (geoterra@geoterrainfo.net) po ključnim riječima. Rezultati sadrže ID foldera koje možeš koristiti s list_drive_folder.", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }));
    tools.push(fn("list_drive_folder", "Ispiši sadržaj (podfoldere i datoteke) određenog Google Drive foldera po ID-u. Koristi kad korisnik traži podfoldere ili sadržaj nekog foldera.", {
      type: "object",
      properties: { folder_id: { type: "string", description: "Google Drive folder ID" } },
      required: ["folder_id"],
    }));
  }

  tools.push(
    fn("search_sdge", "Pretraži SDGE sustav (predmeti, elaborati).", {
      type: "object",
      properties: {
        naziv: { type: "string" },
        godina: { type: "string" },
        status: { type: "string" },
        kat_opcina: { type: "string" },
        interni_broj: { type: "string" },
        izradio: { type: "string" },
        max_pages: { type: "number" },
      },
    }),
    fn("download_sdge_pdf", "Preuzmi PDF iz SDGE-a.", {
      type: "object",
      properties: { broj_predmeta: { type: "string" } },
      required: ["broj_predmeta"],
    }),
    fn("sdge_povratnice", "Dohvati povratnice (otprema/dostava) za SDGE predmet. Koristi kad korisnik pita za povratnice, otpremu, dostavu za neki predmet.", {
      type: "object",
      properties: {
        broj_predmeta: { type: "string", description: "Broj predmeta u formatu 'X/YYYY' (npr. '3/2026')" },
        redni_broj: { type: "string", description: "Redni broj predmeta (npr. '3')" },
        godina: { type: "string", description: "Godina (npr. '2026')" },
      },
    }),
    fn("search_geoterra_app", "Pretraži GeoTerra aplikaciju (Kanban ploče i kartice).", {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    }),
    fn("update_geoterra_card", "Ažuriraj karticu u GeoTerra aplikaciji.", {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        narucitelj_ime: { type: "string" },
        narucitelj_oib: { type: "string" },
        narucitelj_adresa: { type: "string" },
        kontakt: { type: "string" },
        katastarska_opcina: { type: "string" },
        katastarska_cestica: { type: "string" },
        adresa_cestice: { type: "string" },
        postanski_broj: { type: "string" },
        vrsta_posla: { type: "array", items: { type: "string" } },
        due_date: { type: "string" },
      },
      required: ["card_id"],
    }),
    fn("search_oss", "Pretraži OSS portal (oss.uredjenazemlja.hr). Modovi: 'search' za pretragu čestice, 'details' za detalje, 'owners' za vlasnike, 'land_registry' za ZK uložak, 'download' za PDF. Kad dobiješ parcel_id iz pretrage, koristi ga za ostale modove.", {
      type: "object",
      properties: {
        cestica: { type: "string", description: "Broj čestice (npr. '1234' ili '1234/2')" },
        katastarska_opcina: { type: "string", description: "Naziv katastarske općine (npr. 'Zagreb', 'Trnje')" },
        mode: { type: "string", enum: ["search", "details", "owners", "land_registry", "download"], description: "Mod pretrage. Default: search" },
        parcel_id: { type: "string", description: "ID čestice iz prethodne pretrage (za details/owners/land_registry/download)" },
        doc_type: { type: "string", enum: ["posjedovni_list", "kopija_plana", "zk_izvadak"], description: "Tip dokumenta za download" },
      },
    }),
    fn("lookup_oib", "Provjeri podatke o tvrtki ili osobi po OIB-u.", {
      type: "object",
      properties: { oib: { type: "string" } },
      required: ["oib"],
    }),
    fn("search_gmail", "Pretraži Gmail inbox (admin račun). Koristi Gmail search operatore (from:, subject:, has:attachment, itd.).", {
      type: "object",
      properties: { query: { type: "string", description: "Gmail search query" } },
      required: ["query"],
    }),
    fn("search_solo", "Pretraži Solo.com.hr — račune, ponude i radne naloge. Bez tipa pretražuje SVE. Koristi query za filtriranje po kupcu ili broju.", {
      type: "object",
      properties: {
        tip: { type: "string", enum: ["racun", "ponuda", "radni_nalog"], description: "Tip dokumenta. Prazno = pretražuj sve tipove." },
        query: { type: "string", description: "Filtar po kupcu, broju, ili opisu (npr. 'Pogačić')" },
        stranica: { type: "number", description: "Broj stranice" },
      },
    }),
    fn("fill_zahtjev", "Ispuni obrazac Zahtjev za izdavanje potvrde.", {
      type: "object",
      properties: {
        card_id: { type: "string" },
        title: { type: "string" },
        katastarska_opcina: { type: "string" },
        katastarska_cestica: { type: "string" },
        adresa_cestice: { type: "string" },
        postanski_broj: { type: "string" },
        vrsta_posla: { type: "array", items: { type: "string" } },
        narucitelj_ime: { type: "string" },
        narucitelj_adresa: { type: "string" },
        narucitelj_oib: { type: "string" },
        kontakt: { type: "string" },
        description: { type: "string" },
      },
    }),
    fn("search_ideas", "Pretraži sve Stellanove spremljene ideje. Koristi kad korisnik pita 'koje ideje imam', 'što smo planirali', 'sjeti me ideja'.", {
      type: "object",
      properties: { query: { type: "string", description: "Opcionalni filter (ostavi prazno za sve ideje)" } },
    }),
    fn("search_memory", "Semantički pretraži Stellanovu memoriju. Koristi za 'što znamo o X', 'sjeti me', 'što smo pričali o'.", {
      type: "object",
      properties: { 
        query: { type: "string", description: "Što tražiš u memoriji" },
        memory_type: { type: "string", description: "Opcionalni filter: conversation, idea, fact, decision, person, daily_summary" }
      },
      required: ["query"],
    }),
    fn("get_proactive_suggestions", "Daj proaktivne prijedloge — nedovršene ideje, stare dogovore, što treba pratiti. Koristi kad korisnik pita 'što sam zaboravio', 'što treba napraviti', 'što sam planirao'.", {
      type: "object",
      properties: {},
    }),
    fn("fill_pdf", "Ispuni PDF obrazac s form poljima.", {
      type: "object",
      properties: {
        pdf_url: { type: "string" },
        pdf_base64: { type: "string" },
        list_fields_only: { type: "boolean" },
        field_values: { type: "object" },
      },
    }),
  );

  if (opts.hasAgent) {
    tools.push(
      fn("run_python", "Pokreni Python skriptu na lokalnom računalu. Označi s 🖥️ **Lokalni agent**.", {
        type: "object",
        properties: {
          code: { type: "string" },
          filename: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          timeout: { type: "number" },
        },
        required: ["code"],
      }),
      fn("run_shell", "Izvrši shell komandu na lokalnom računalu.", {
        type: "object",
        properties: { command: { type: "string" }, cwd: { type: "string" }, timeout: { type: "number" } },
        required: ["command"],
      }),
      fn("agent_read_file", "Pročitaj datoteku s lokalnog računala.", {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      }),
      fn("agent_write_file", "Zapiši datoteku na lokalno računalo.", {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      }),
      fn("agent_list_files", "Izlistaj datoteke u workspace-u.", {
        type: "object",
        properties: { path: { type: "string" }, recursive: { type: "boolean" } },
      }),
      fn("git_push", "Git add, commit i push.", {
        type: "object",
        properties: {
          repo_path: { type: "string" },
          message: { type: "string" },
          files: { type: "array", items: { type: "string" } },
        },
      }),
      fn("pip_install", "Instaliraj Python pakete.", {
        type: "object",
        properties: { packages: { type: "array", items: { type: "string" } } },
        required: ["packages"],
      }),
      fn("playwright", "Kontroliraj web browser (Playwright). Akcije: navigate, screenshot, click, fill, extract, evaluate, pdf, select, get_html, wait, close. Označi s 🌐 **Playwright**.", {
        type: "object",
        properties: {
          action: { type: "string" },
          url: { type: "string" },
          selector: { type: "string" },
          value: { type: "string" },
          script: { type: "string" },
          timeout: { type: "number" },
          wait_for: { type: "string" },
          full_page: { type: "boolean" },
        },
        required: ["action"],
      }),
      // Recording tools
      fn("start_recording", "Pokreni snimanje Playwright akcija. Koristi kad korisnik kaže 'snimi', 'uči', 'zapamti korake'.", {
        type: "object",
        properties: { name: { type: "string", description: "Ime akcije koja se snima" } },
        required: ["name"],
      }),
      fn("stop_recording", "Zaustavi snimanje bez spremanja.", { type: "object", properties: {} }),
      fn("save_action", "Spremi snimljene korake kao Python skriptu. Pozovi nakon što je korisnik završio s koracima.", {
        type: "object",
        properties: { name: { type: "string", description: "Ime akcije za spremanje" } },
        required: ["name"],
      }),
      fn("list_actions", "Prikaži sve snimljene/naučene akcije.", { type: "object", properties: {} }),
      fn("run_action", "Pokreni naučenu akciju po imenu.", {
        type: "object",
        properties: { name: { type: "string", description: "Ime akcije za pokretanje" } },
        required: ["name"],
      }),
    );
  }

  // ── Stellan Self-Awareness Tools ──────────────────────────
  tools.push(
    fn("db_inspect", "Pregledaj strukturu tablice u bazi (stupci, broj redova, primjeri podataka). Bez argumenta daje listu svih tablica. Koristi kad trebaš razumjeti podatke.", {
      type: "object",
      properties: { table: { type: "string", description: "Ime tablice (npr. 'cards', 'invoices'). Prazno = lista svih tablica." } },
    }),
    fn("db_query", "Čitaj podatke iz bilo koje tablice u bazi. Možeš filtrirati po stupcima.", {
      type: "object",
      properties: {
        table: { type: "string", description: "Ime tablice" },
        select: { type: "string", description: "Stupci za dohvatiti (npr. 'id,title,status'). Default: *" },
        filter: { type: "object", description: "Filter (npr. {\"status\": \"active\"})" },
        limit: { type: "number", description: "Maks broj redova. Default: 20" },
      },
      required: ["table"],
    }),
    fn("register_tool", "Registriraj novi tool koji Stellan može koristiti u budućnosti. Koristi kad napraviš novu edge function ili otkriješ novi capability.", {
      type: "object",
      properties: {
        name: { type: "string", description: "Jedinstveno ime toola (snake_case)" },
        description: { type: "string", description: "Opis što tool radi" },
        category: { type: "string", description: "Kategorija (sdge, oss, geodezija, web, app, custom)" },
        edge_function: { type: "string", description: "Ime Supabase edge function ako postoji" },
        parameters: { type: "object", description: "JSON Schema za parametre toola" },
      },
      required: ["name", "description"],
    }),
    fn("save_knowledge", "Spremi novo znanje u Stellanovu bazu znanja. Koristi kad naučiš nešto novo, kad korisnik kaže 'zapamti ovo', ili kad otkriješ korisne informacije.", {
      type: "object",
      properties: {
        title: { type: "string", description: "Naslov znanja" },
        content: { type: "string", description: "Sadržaj — može biti markdown" },
        category: { type: "string", description: "Kategorija (geodezija, tech, firma, sdge, oss, cad, custom)" },
        tags: { type: "array", items: { type: "string" }, description: "Tagovi za pretragu" },
      },
      required: ["title", "content"],
    }),
    fn("search_knowledge", "Pretraži Stellanovu bazu znanja po ključnim riječima.", {
      type: "object",
      properties: { query: { type: "string", description: "Tekst pretrage" } },
      required: ["query"],
    }),
  );

  // ── Geodetski alati ───────────────────────────────────────
  tools.push(
    fn("generate_file", "Generiraj datoteku za preuzimanje (LISP, GML, CSV, GeoJSON, KML, TXT, TSX, JS, PY...). UVIJEK uključi CIJELI sadržaj datoteke. Download gumb se automatski prikazuje — NE piši linkove u odgovoru.", {
      type: "object",
      properties: {
        filename: { type: "string", description: "Ime datoteke s ekstenzijom (npr. 'export_tocke.lsp', 'cestica.gml')" },
        content: { type: "string", description: "Sadržaj datoteke" },
        content_type: { type: "string", description: "MIME tip (opcionalno, auto-detektira se iz ekstenzije)" },
      },
      required: ["filename", "content"],
    }),
    fn("generate_zip", "Generiraj ZIP s više datoteka za preuzimanje. OBAVEZNO koristi kad ispravljaš ili vraćaš više datoteka. SVAKA datoteka mora biti KOMPLETNA od prvog do zadnjeg reda — nikad ne piši samo diff. Download gumb se automatski prikazuje — NE piši linkove u odgovoru.", {
      type: "object",
      properties: {
        zip_filename: { type: "string", description: "Ime ZIP datoteke (npr. 'ispravke.zip', 'projekt.zip')" },
        files: {
          type: "array",
          description: "Lista datoteka za zip",
          items: {
            type: "object",
            properties: {
              filename: { type: "string", description: "Ime datoteke s ekstenzijom (npr. 'ChatMessage.tsx')" },
              content: { type: "string", description: "CIJELI sadržaj datoteke — ne samo diff, nego kompletna datoteka" },
            },
            required: ["filename", "content"],
          },
        },
      },
      required: ["zip_filename", "files"],
    }),
    fn("parse_gml", "Parsiraj GML datoteku i izvuci katastarske čestice, koordinate, površine, točke. Koristi kad korisnik uploadea GML.", {
      type: "object",
      properties: {
        gml_content: { type: "string", description: "Sadržaj GML datoteke" },
      },
      required: ["gml_content"],
    }),
    fn("generate_gml", "Generiraj GML datoteku iz podataka o česticama. Koordinate moraju biti u HTRS96/TM (EPSG:3765).", {
      type: "object",
      properties: {
        parcels: { type: "array", description: "Lista čestica. Svaka ima: brojCestice, coordinates [[e,n],...], povrsina, katOpcinaId", items: { type: "object" } },
        srs: { type: "string", description: "Koordinatni sustav (default: EPSG:3765)" },
        ko_id: { type: "string", description: "ID katastarske općine" },
      },
      required: ["parcels"],
    }),
    fn("convert_coordinates", "Konvertiraj koordinate između WGS84 (GPS, EPSG:4326) i HTRS96/TM (EPSG:3765). Za WGS84 šalji [lon, lat], za HTRS96 šalji [easting, northing].", {
      type: "object",
      properties: {
        coordinates: { type: "array", description: "Lista koordinata [[x,y], [x,y]...]", items: { type: "array", items: { type: "number" } } },
        from_srs: { type: "string", description: "Izvorni sustav: 'WGS84' ili 'HTRS96'" },
        to_srs: { type: "string", description: "Ciljni sustav: 'WGS84' ili 'HTRS96'" },
      },
      required: ["coordinates", "from_srs", "to_srs"],
    }),
  );

  return tools;
}

// ─────────────────────────────────────────────────────────────
//  IZVRŠAVANJE TOOL CALLOVA
// ─────────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: any,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
  },
): Promise<string> {
  const { accessToken, brainFolderId, geoterraToken, supabaseAdmin, user_id, openaiApiKey } = ctx;

  if (ctx.enableDriveTools && accessToken && brainFolderId) {
    const driveToolNames = [
      "create_drive_folder", "create_drive_file", "list_drive_files",
      "read_brain_file", "rename_drive_item", "move_drive_item", "copy_drive_file",
    ];
    if (driveToolNames.includes(toolName)) return executeDriveTool(accessToken, brainFolderId, toolName, args);
  }

  switch (toolName) {
    case "search_trello":
      return searchTrello(args.query || "");
    case "scrape_website":
      return scrapeWebsite(args.url || "");
    case "web_search":
    case "search_internet":
      return webSearch(args.query || "");
    case "search_drive":
      return geoterraToken
        ? searchGoogleDrive(geoterraToken, args.query || "")
        : JSON.stringify({ success: false, error: "Drive token not available" });
    case "list_drive_folder":
      return geoterraToken
        ? listDriveFolder(geoterraToken, args.folder_id || "")
        : JSON.stringify({ success: false, error: "Drive token not available" });
    case "search_sdge":
      return searchSdge(args);
    case "download_sdge_pdf":
      return downloadSdgePdf(args);
    case "sdge_povratnice": {
      // Prvo probaj Playwright agent (pouzdanije od Vaadin RPC)
      const AGENT_URL = Deno.env.get("AGENT_SERVER_URL");
      if (AGENT_URL) {
        try {
          const agentResult = await callAgent("sdge/povratnice", args);
          const agentParsed = JSON.parse(agentResult);
          if (agentParsed.success && (agentParsed.povratnice_count > 0 || agentParsed.screenshot_base64)) {
            // Upload screenshot if present
            if (agentParsed.screenshot_base64) {
              try {
                const raw = atob(agentParsed.screenshot_base64);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                const filename = `screenshots/${user_id}/sdge_pov_${Date.now()}.png`;
                const { data: upData, error: upErr } = await supabaseAdmin.storage
                  .from("screenshots")
                  .upload(filename, bytes, { contentType: "image/png", upsert: true });
                if (!upErr && upData) {
                  const { data: urlData } = supabaseAdmin.storage.from("screenshots").getPublicUrl(filename);
                  if (urlData?.publicUrl) {
                    agentParsed.screenshot_url = urlData.publicUrl;
                    agentParsed.display = `![SDGE povratnice](${urlData.publicUrl})`;
                    delete agentParsed.screenshot_base64;
                  }
                }
              } catch (e) { console.error("SDGE screenshot upload:", e); }
            }
            return JSON.stringify(agentParsed);
          }
          console.log("[SDGE Povratnice] Agent returned no results, falling back to edge function");
        } catch (e) {
          console.log("[SDGE Povratnice] Agent error:", e);
        }
      }
      // Fallback: Vaadin RPC edge function
      return sdgePovratnice(args);
    }
    case "search_geoterra_app":
      return searchGeoterraApp(args.query || "");
    case "update_geoterra_card":
      return updateGeoterraCard(args);
    case "search_oss": {
      const ossResult = await searchOss(args);
      // Upload screenshot if present
      try {
        const ossParsed = JSON.parse(ossResult);
        if (ossParsed.screenshot_base64) {
          try {
            const raw = atob(ossParsed.screenshot_base64);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const filename = `screenshots/${user_id}/oss_${Date.now()}.png`;
            const { data: upData, error: upErr } = await supabaseAdmin.storage
              .from("screenshots")
              .upload(filename, bytes, { contentType: "image/png", upsert: true });
            if (!upErr && upData) {
              const { data: urlData } = supabaseAdmin.storage.from("screenshots").getPublicUrl(filename);
              if (urlData?.publicUrl) {
                ossParsed.screenshot_url = urlData.publicUrl;
                ossParsed.display = `![OSS rezultat](${urlData.publicUrl})`;
                delete ossParsed.screenshot_base64;
                return JSON.stringify(ossParsed);
              }
            }
          } catch (e) {
            console.error("OSS screenshot upload error:", e);
          }
        }
      } catch { /* not JSON */ }
      return ossResult;
    }
    case "lookup_oib":
      return lookupOib(args.oib || "");
    case "search_gmail":
      return searchGmail(args.query || "");
    case "search_solo":
      return searchSolo(args);
    case "search_ideas":
      return searchIdeasFromMemory(supabaseAdmin, user_id, args.query || "", openaiApiKey);
    case "search_memory": {
      const memType = args.memory_type || null;
      const embedding = await createEmbedding(args.query, openaiApiKey);
      if (!embedding) return JSON.stringify({ success: false, error: "Embedding failed" });
      const { data } = await supabaseAdmin.rpc("search_stellan_memory", {
        query_embedding: embedding,
        match_user_id: user_id,
        match_count: 10,
        min_importance: 1,
        memory_types: memType ? [memType] : null,
      });
      if (!data?.length) return JSON.stringify({ success: true, results: "Nema relevantnih memorija.", count: 0 });
      const results = data.filter((m: any) => m.similarity > 0.65).map((m: any) => `[${m.memory_type}] ${m.content}`).join("\n");
      return JSON.stringify({ success: true, results: results || "Nema dovoljno relevantnih rezultata.", count: data.length });
    }
    case "get_proactive_suggestions":
      return getProactiveSuggestions(supabaseAdmin, user_id, openaiApiKey).then(s => 
        JSON.stringify({ success: true, suggestions: s || "Nema posebnih prijedloga trenutno." })
      );
    case "fill_zahtjev":
      return fillZahtjev(args);
    case "fill_pdf":
      return fillPdf(args);
    case "run_python":
      return callAgent("run_python", args);
    case "run_shell":
      return callAgent("run_shell", args);
    case "agent_read_file":
      return callAgent("read_file", args);
    case "agent_write_file":
      return callAgent("write_file", args);
    case "agent_list_files":
      return callAgent("list_files", args);
    case "git_push":
      return callAgent("git_push", args);
    case "pip_install":
      return callAgent("pip_install", args);
    case "playwright": {
      const pwResult = await callAgent("playwright", args);
      try {
        const parsed = JSON.parse(pwResult);
        if (parsed.screenshot_base64 && parsed.success) {
          // Upload screenshot to Supabase Storage za pouzdan prikaz u chatu
          let imgUrl = "";
          try {
            const raw = atob(parsed.screenshot_base64);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const filename = `screenshots/${user_id}/${Date.now()}.png`;
            const { data: upData, error: upErr } = await supabaseAdmin.storage
              .from("screenshots")
              .upload(filename, bytes, { contentType: "image/png", upsert: true });
            if (!upErr && upData) {
              const { data: urlData } = supabaseAdmin.storage.from("screenshots").getPublicUrl(filename);
              imgUrl = urlData?.publicUrl || "";
            }
          } catch (e) {
            console.error("Screenshot upload error:", e);
          }
          const msg = parsed.message || "Screenshot napravljen";
          const title = parsed.title ? ` — **${parsed.title}**` : "";
          const imgMd = imgUrl
            ? `![screenshot](${imgUrl})`
            : `![screenshot](data:image/png;base64,${parsed.screenshot_base64})`;
          return JSON.stringify({
            ...parsed,
            display: `${imgMd}\n\n${msg}${title}`,
            screenshot_base64: "[uploaded]",
            screenshot_url: imgUrl || undefined,
          });
        }
      } catch { /* vrati original */ }
      return pwResult;
    }
    case "start_recording":
      return callAgent("record/start", args);
    case "stop_recording":
      return callAgent("record/stop", {});
    case "save_action":
      return callAgent("record/save", args);
    case "list_actions":
      return callAgent("record/list", {});
    case "run_action":
      return callAgent("record/run", args);
    // ── Stellan Self-Awareness ──────────────────────────────
    case "db_inspect":
      return dbInspect(supabaseAdmin, args);
    case "db_query":
      return dbQuery(supabaseAdmin, args);
    case "register_tool":
      return registerTool(supabaseAdmin, args);
    case "save_knowledge":
      return saveKnowledge(supabaseAdmin, args);
    case "search_knowledge":
      return searchKnowledge(supabaseAdmin, args.query || "");
    // ── Geodetski alati ──────────────────────────────────────
    case "generate_file":
      return generateFile(supabaseAdmin, user_id, args);
    case "generate_zip":
      return generateZip(supabaseAdmin, user_id, args);
    case "parse_gml":
      return parseGml(args);
    case "generate_gml":
      return generateGml(args);
    case "convert_coordinates":
      return convertCoordinates(args);
    default:
      return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}

// ─── Helper: inject download block after generate_file/generate_zip ──
async function injectFileDownload(
  toolName: string,
  result: string,
  streamDelta: (text: string) => Promise<void>,
): Promise<string> {
  if (toolName !== "generate_file" && toolName !== "generate_zip") return "";
  try {
    const parsed = JSON.parse(result);
    if (parsed.success && parsed.url && parsed.filename) {
      const sizeKb = parsed.size ? `${(parsed.size / 1024).toFixed(1)} KB` : "";
      const extra = parsed.file_count ? ` (${parsed.file_count} datoteka)` : "";
      const block = `\n\n%%FILE_DOWNLOAD:${JSON.stringify({ filename: parsed.filename, url: parsed.url, size: sizeKb + extra })}%%\n\n`;
      await streamDelta(block);
      return block;
    }
  } catch { /* ignore */ }
  return "";
}

// ─────────────────────────────────────────────────────────────
//  OPENAI STREAMING SA TOOL USE AGENTIC LOOP
// ─────────────────────────────────────────────────────────────

// ─── OPENAI VISION (fallback helper) ─────────────────────────
async function analyzeImageWithOpenAI(base64DataUrl: string, textContext: string, apiKey: string): Promise<string> {
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        max_completion_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `Precizno i detaljno opiši što točno vidiš na ovoj slici. ` +
                  `Budi precizan s tekstom, UI elementima, nazivima, brojevima i lokacijama. ` +
                  `Ako nešto nije jasno vidljivo, napiši [nečitko]. ` +
                  `Ne pretpostavljaj sadržaj koji nije vidljiv.` +
                  (textContext ? `\n\nKontekst korisnika: ${textContext}` : ""),
              },
              {
                type: "image_url",
                image_url: { url: base64DataUrl },
              },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      console.error("OpenAI vision error:", resp.status, await resp.text());
      return "[OpenAI vision greška]";
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "[OpenAI nije vratio odgovor]";
  } catch (e) {
    console.error("OpenAI vision exception:", e);
    return "[OpenAI vision nedostupan]";
  }
}

async function preprocessImagesWithOpenAI(messages: any[], openaiApiKey: string): Promise<any[]> {
  const imgRegex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
  const result = [];
  for (const msg of messages) {
    if (msg.role !== "user" || typeof msg.content !== "string") {
      result.push(msg);
      continue;
    }
    const matches = [...msg.content.matchAll(new RegExp(imgRegex.source, "g"))];
    if (matches.length === 0) {
      result.push(msg);
      continue;
    }
    const textContext = msg.content.replace(new RegExp(imgRegex.source, "g"), "").trim();
    let processedContent = msg.content;
    for (const m of matches) {
      const description = await analyzeImageWithOpenAI(m[2], textContext, openaiApiKey);
      processedContent = processedContent.replace(
        m[0],
        `\n[ANALIZA SLIKE "${m[1]}":\n${description}\n]`
      );
    }
    result.push({ ...msg, content: processedContent });
  }
  return result;
}
// ──────────────────────────────────────────────────────────────

// Convert messages to Responses API input format, extracting inline base64 images for vision
function convertMessagesToResponsesInput(messages: any[]): any[] {
  // Truncate to last 20 messages to avoid context overflow
  const MAX_MESSAGES = 20;
  const MAX_CONTENT_LENGTH = 30000; // per message
  const recentMessages = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;

  return recentMessages.map((m: any) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    let rawContent = typeof m.content === "string" ? m.content : String(m.content ?? "");
    
    // Truncate very long messages (web search results, large code files)
    if (rawContent.length > MAX_CONTENT_LENGTH) {
      rawContent = rawContent.substring(0, MAX_CONTENT_LENGTH) + "\n...[skraćeno]";
    }

    // Strip %%FILE_DOWNLOAD%% markers from history (already rendered as buttons)
    rawContent = rawContent.replace(/%%FILE_DOWNLOAD:.*?%%/g, "").trim();

    const imageRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/g;

    const contentParts: any[] = [];
    let match;
    let hasImages = false;
    while ((match = imageRegex.exec(rawContent)) !== null) {
      hasImages = true;
    }

    // Assistant poruke koriste "output_text", user poruke koriste "input_text"
    const textType = role === "assistant" ? "output_text" : "input_text";

    const textContent = rawContent.replace(imageRegex, "").trim();
    if (textContent) {
      contentParts.push({ type: textType, text: textContent });
    }

    if (role === "user" && hasImages) {
      imageRegex.lastIndex = 0;
      while ((match = imageRegex.exec(rawContent)) !== null) {
        contentParts.push({
          type: "input_image",
          image_url: match[2],
          detail: "auto",
        });
      }
    }

    if (contentParts.length === 0) {
      contentParts.push({ type: textType, text: "" });
    }

    const item: any = {
      type: "message",
      role,
      content: contentParts,
    };

    return item;
  });
}

function convertCustomToolsToResponsesTools(customTools: any[]): any[] {
  const mapped = (customTools || [])
    .filter((tool: any) => tool?.type === "function" && tool?.function?.name)
    .map((tool: any) => ({
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));

  return [
    { type: "web_search" },
    ...mapped,
  ];
}

function extractTextFromResponse(response: any): string {
  const parts: string[] = [];

  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (item?.type === "message" && item?.role === "assistant" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if ((c?.type === "output_text" || c?.type === "text") && c?.text) {
            parts.push(c.text);
          }
        }
      }
    }
  }

  if (parts.length === 0 && typeof response?.output_text === "string") {
    parts.push(response.output_text);
  }

  return parts.join("").trim();
}

function extractFunctionCallsFromResponse(response: any): Array<{ id?: string; call_id: string; name: string; arguments: string }> {
  const calls: Array<{ id?: string; call_id: string; name: string; arguments: string }> = [];

  for (const item of response?.output || []) {
    if (item?.type === "function_call" && item?.name && item?.call_id) {
      calls.push({
        id: item.id,
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments || "{}",
      });
    }
  }

  return calls;
}

function extractWebSourcesFromResponse(response: any): Array<{ title: string; url: string }> {
  const out: Array<{ title: string; url: string }> = [];
  const seen = new Set<string>();

  for (const item of response?.output || []) {
    if (item?.type !== "web_search_call") continue;
    const sources = item?.action?.sources || item?.sources || [];
    if (!Array.isArray(sources)) continue;

    for (const src of sources) {
      const url = src?.url || "";
      const title = src?.title || src?.name || url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ title, url });
    }
  }

  return out;
}

function appendWebSourcesToAnswer(answer: string, sources: Array<{ title: string; url: string }>): string {
  if (!sources.length) return answer;
  const lines = sources.slice(0, 5).map((s) => `- ${s.title}: ${s.url}`);
  return `${answer.trim()}\n\nIzvori:\n${lines.join("\n")}`.trim();
}

async function runResponsesApiWithTools(
  openaiApiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
    model: string;
  },
): Promise<string> {
  let fullResponse = "";
  const OPENAI_MODEL = ctx.model;
  const responseTools = convertCustomToolsToResponsesTools(tools);
  
  let pendingInput: any[] = convertMessagesToResponsesInput(messages);
  let previousResponseId: string | null = null;

  const streamDelta = async (text: string) => {
    if (!text) return;
    const sseData = JSON.stringify({ choices: [{ delta: { content: text } }] });
    await writer.write(encoder.encode(`data: ${sseData}\n\n`));
  };

  const emitStatus = async (status: string) => {
    const statusEvent = JSON.stringify({ status });
    await writer.write(encoder.encode(`data: ${statusEvent}\n\n`));
  };

  for (let iteration = 0; iteration < 10; iteration++) {
    const requestBody: any = {
      model: OPENAI_MODEL,
      instructions: systemPrompt,
      input: pendingInput,
      tools: responseTools,
      tool_choice: "auto",
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      include: ["web_search_call.action.sources"],
      reasoning: { effort: "medium" },
      store: true,
    };

    if (previousResponseId) {
      requestBody.previous_response_id = previousResponseId;
    }

    const res = await fetchWithTimeout(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI Responses API error:", res.status, errText);
      // Parse error for user-friendly message
      let detail = "";
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || errText.substring(0, 300);
      } catch { detail = errText.substring(0, 300); }
      const errMsg = `⚠️ API greška (${res.status}): ${detail}`;
      await streamDelta(errMsg);
      fullResponse += errMsg;
      break;
    }

    const response = await res.json();
    previousResponseId = response?.id || previousResponseId;

    const functionCalls = extractFunctionCallsFromResponse(response);
    const responseText = extractTextFromResponse(response);
    const webSources = extractWebSourcesFromResponse(response);

    if (functionCalls.length === 0) {
      const finalText = appendWebSourcesToAnswer(responseText, webSources);
      if (finalText) {
        await streamDelta(finalText);
        fullResponse += finalText;
      }
      break;
    }

    const toolStatusMap: Record<string, string> = {
      "search_sdge": "📊 Pretražujem SDGE portal...",
      "search_geoterra_app": "📋 Pretražujem GeoTerra projekte...",
      "search_drive": "📁 Pretražujem Google Drive...",
      "search_gmail": "✉️ Pretražujem Gmail...",
      "search_solo": "🧾 Pretražujem Solo račune...",
      "search_oss": "🗺️ Pretražujem OSS portal...",
      "search_trello": "📌 Pretražujem Trello...",
      "lookup_oib": "🔎 Provjeravam OIB...",
      "download_sdge_pdf": "📄 Preuzimam PDF iz SDGE...",
      "run_python": "💻 Pokrećem Python skriptu...",
      "run_shell": "💻 Izvršavam naredbu...",
      "playwright": "🌐 Kontroliram preglednik...",
      "start_recording": "🔴 Pokrećem snimanje...",
      "stop_recording": "⏹ Zaustavljam snimanje...",
      "save_action": "💾 Spremam akciju...",
      "list_actions": "📋 Učitavam akcije...",
      "run_action": "▶ Pokrećem akciju...",
      "fill_zahtjev": "📝 Ispunjavam zahtjev...",
      "scrape_website": "🔗 Dohvaćam web stranicu...",
      "search_memory": "🧠 Pretražujem memoriju...",
      "create_drive_folder": "🧠 Stvaram folder u brainu...",
      "create_drive_file": "🧠 Pišem datoteku u brain...",
      "list_drive_files": "🧠 Čitam brain datoteke...",
      "read_brain_file": "🧠 Čitam brain datoteku...",
      "rename_drive_item": "🧠 Preimenujem stavku u brainu...",
      "move_drive_item": "🧠 Premještam stavku u brainu...",
      "copy_drive_file": "🧠 Kopiram datoteku u brainu...",
    };

    for (const call of functionCalls) {
      await emitStatus(toolStatusMap[call.name] || `🔍 ${call.name}...`);
    }

    const functionOutputs: any[] = [];

    for (const call of functionCalls) {
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        args = {};
      }

      const result = await executeTool(call.name, args, ctx);
      console.log(`[Responses Tools] ${call.name} result: ${result.slice(0, 200)}`);

      // Inject download block for generate_file
      const dlBlock = await injectFileDownload(call.name, result, streamDelta);
      if (dlBlock) fullResponse += dlBlock;

      let toolContent = result;
      try {
        const parsed = JSON.parse(result);
        if (parsed.display && (parsed.display.includes("![") || parsed.display.includes("data:image"))) {
          await streamDelta("\n\n" + parsed.display + "\n\n");
          fullResponse += "\n\n" + parsed.display + "\n\n";
          toolContent = JSON.stringify({ ...parsed, display: "[prikazano korisniku]" });
        }
      } catch {
        // ignore
      }

      functionOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: toolContent,
      });
    }

    pendingInput = functionOutputs;
  }

  return fullResponse;
}

// Backward-compatible alias so ostatak fajla ne puca
async function runOpenAIWithTools(
  openaiApiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
    model: string;
  },
): Promise<string> {
  return runResponsesApiWithTools(
    openaiApiKey,
    systemPrompt,
    messages,
    tools,
    writer,
    encoder,
    ctx,
  );
}

// ─────────────────────────────────────────────────────────────
//  ANTHROPIC CLAUDE — Messages API handler
// ─────────────────────────────────────────────────────────────

function convertMessagesToAnthropic(messages: any[]): { system: string; messages: any[] } {
  let systemText = "";
  const out: any[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemText += (systemText ? "\n" : "") + (typeof m.content === "string" ? m.content : String(m.content ?? ""));
      continue;
    }
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = typeof m.content === "string" ? m.content : String(m.content ?? "");
    
    // Handle inline images for vision
    const imgRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/g;
    const parts: any[] = [];
    let lastIdx = 0;
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      const before = content.slice(lastIdx, match.index).trim();
      if (before) parts.push({ type: "text", text: before });
      parts.push({
        type: "image",
        source: { type: "base64", media_type: `image/${match[3]}`, data: match[4] },
      });
      lastIdx = match.index + match[0].length;
    }
    const remaining = content.slice(lastIdx).trim();
    if (remaining) parts.push({ type: "text", text: remaining });
    
    if (parts.length === 0) parts.push({ type: "text", text: "" });
    
    out.push({ role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
  }

  return { system: systemText, messages: out };
}

function convertToolsToAnthropic(tools: any[]): any[] {
  return (tools || [])
    .filter((t: any) => t?.type === "function" && t?.function?.name)
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters || { type: "object", properties: {} },
    }));
}

async function runAnthropicWithTools(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
    model: string;
  },
): Promise<string> {
  let fullResponse = "";
  const anthropicTools = convertToolsToAnthropic(tools);
  const { system: extractedSystem, messages: anthropicMessages } = convertMessagesToAnthropic(messages);
  const finalSystem = [systemPrompt, extractedSystem].filter(Boolean).join("\n\n");

  const streamDelta = async (text: string) => {
    if (!text) return;
    const sseData = JSON.stringify({ choices: [{ delta: { content: text } }] });
    await writer.write(encoder.encode(`data: ${sseData}\n\n`));
  };
  const emitStatus = async (status: string) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
  };

  let currentMessages = [...anthropicMessages];

  for (let iteration = 0; iteration < 10; iteration++) {
    const body: any = {
      model: ctx.model,
      max_tokens: 8192,
      system: finalSystem,
      messages: currentMessages,
      stream: true,
    };
    if (anthropicTools.length > 0) {
      body.tools = anthropicTools;
      body.tool_choice = { type: "auto" };
    }

    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error:", res.status, errText);
      let detail = "";
      try { const j = JSON.parse(errText); detail = j?.error?.message || errText.substring(0, 300); } catch { detail = errText.substring(0, 300); }
      const errMsg = `⚠️ Claude greška (${res.status}): ${detail}`;
      await streamDelta(errMsg);
      fullResponse += errMsg;
      break;
    }

    // Parse SSE stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let iterationText = "";
    let toolUseBlocks: any[] = [];
    let currentToolUse: any = null;
    let stopReason = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "content_block_start") {
            if (evt.content_block?.type === "tool_use") {
              currentToolUse = { id: evt.content_block.id, name: evt.content_block.name, input: "" };
            }
          } else if (evt.type === "content_block_delta") {
            if (evt.delta?.type === "text_delta" && evt.delta.text) {
              await streamDelta(evt.delta.text);
              iterationText += evt.delta.text;
            } else if (evt.delta?.type === "input_json_delta" && currentToolUse) {
              currentToolUse.input += evt.delta.partial_json || "";
            }
          } else if (evt.type === "content_block_stop" && currentToolUse) {
            toolUseBlocks.push({ ...currentToolUse });
            currentToolUse = null;
          } else if (evt.type === "message_delta") {
            stopReason = evt.delta?.stop_reason || stopReason;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    fullResponse += iterationText;

    if (stopReason !== "tool_use" || toolUseBlocks.length === 0) break;

    // Execute tool calls
    const assistantContent: any[] = [];
    if (iterationText) assistantContent.push({ type: "text", text: iterationText });
    for (const tb of toolUseBlocks) {
      let parsedInput = {};
      try { parsedInput = JSON.parse(tb.input || "{}"); } catch { parsedInput = {}; }
      assistantContent.push({ type: "tool_use", id: tb.id, name: tb.name, input: parsedInput });
    }

    const toolResults: any[] = [];
    for (const tb of toolUseBlocks) {
      let args = {};
      try { args = JSON.parse(tb.input || "{}"); } catch { args = {}; }
      await emitStatus(`🔍 ${tb.name}...`);
      const result = await executeTool(tb.name, args, ctx);
      // Inject download block for generate_file
      const dlBlock = await injectFileDownload(tb.name, result, streamDelta);
      if (dlBlock) fullResponse += dlBlock;
      toolResults.push({ type: "tool_result", tool_use_id: tb.id, content: result });
    }

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: assistantContent },
      { role: "user", content: toolResults },
    ];
  }

  return fullResponse;
}

// ─────────────────────────────────────────────────────────────
//  GOOGLE GEMINI — Generative Language API handler
// ─────────────────────────────────────────────────────────────

function convertMessagesToGemini(messages: any[], systemPrompt: string): { systemInstruction: any; contents: any[] } {
  const contents: any[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const content = typeof m.content === "string" ? m.content : String(m.content ?? "");
    const parts: any[] = [];
    
    const imgRegex = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([^)]+))\)/g;
    let lastIdx = 0;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const before = content.slice(lastIdx, match.index).trim();
      if (before) parts.push({ text: before });
      parts.push({ inlineData: { mimeType: `image/${match[3]}`, data: match[4] } });
      lastIdx = match.index + match[0].length;
    }
    const remaining = content.slice(lastIdx).trim();
    if (remaining) parts.push({ text: remaining });
    if (parts.length === 0) parts.push({ text: "" });

    contents.push({ role, parts });
  }

  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
  };
}

function convertToolsToGemini(tools: any[]): any[] {
  const fns = (tools || [])
    .filter((t: any) => t?.type === "function" && t?.function?.name)
    .map((t: any) => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters || { type: "object", properties: {} },
    }));
  return fns.length > 0 ? [{ functionDeclarations: fns }] : [];
}

async function runGeminiWithTools(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
    model: string;
  },
): Promise<string> {
  let fullResponse = "";
  const { systemInstruction, contents } = convertMessagesToGemini(messages, systemPrompt);
  const geminiTools = convertToolsToGemini(tools);
  let currentContents = [...contents];

  const streamDelta = async (text: string) => {
    if (!text) return;
    const sseData = JSON.stringify({ choices: [{ delta: { content: text } }] });
    await writer.write(encoder.encode(`data: ${sseData}\n\n`));
  };
  const emitStatus = async (status: string) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
  };

  const geminiModel = ctx.model;
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}`;

  for (let iteration = 0; iteration < 10; iteration++) {
    const body: any = {
      systemInstruction,
      contents: currentContents,
      generationConfig: { maxOutputTokens: 8192 },
    };
    if (geminiTools.length > 0) {
      body.tools = geminiTools;
      body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    }

    const res = await fetchWithTimeout(
      `${baseUrl}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      let detail = "";
      try { const j = JSON.parse(errText); detail = j?.error?.message || errText.substring(0, 300); } catch { detail = errText.substring(0, 300); }
      const errMsg = `⚠️ Gemini greška (${res.status}): ${detail}`;
      await streamDelta(errMsg);
      fullResponse += errMsg;
      break;
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) break;

    const parts = candidate.content?.parts || [];
    let textParts = "";
    const functionCalls: any[] = [];

    for (const part of parts) {
      if (part.text) textParts += part.text;
      if (part.functionCall) functionCalls.push(part.functionCall);
    }

    if (textParts) {
      await streamDelta(textParts);
      fullResponse += textParts;
    }

    if (functionCalls.length === 0) break;

    // Add model response to contents
    currentContents.push({ role: "model", parts });

    // Execute tools and add responses
    const functionResponseParts: any[] = [];
    for (const fc of functionCalls) {
      await emitStatus(`🔍 ${fc.name}...`);
      const result = await executeTool(fc.name, fc.args || {}, ctx);
      // Inject download block for generate_file
      const dlBlock = await injectFileDownload(fc.name, result, streamDelta);
      if (dlBlock) fullResponse += dlBlock;
      let parsedResult: any;
      try { parsedResult = JSON.parse(result); } catch { parsedResult = { result }; }
      functionResponseParts.push({
        functionResponse: { name: fc.name, response: parsedResult },
      });
    }

    currentContents.push({ role: "user", parts: functionResponseParts });
  }

  return fullResponse;
}

// ─────────────────────────────────────────────────────────────
//  xAI GROK — Responses API (web_search + x_search + tools)
// ─────────────────────────────────────────────────────────────

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

async function runOpenAICompatibleWithTools(
  apiKey: string,
  _apiUrl: string, // ignored — always uses Responses API
  systemPrompt: string,
  messages: any[],
  tools: any[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  ctx: {
    accessToken: string | null;
    brainFolderId: string | null;
    geoterraToken: string | null;
    enableDriveTools: boolean;
    supabaseAdmin: any;
    user_id: string;
    openaiApiKey: string;
    model: string;
  },
): Promise<string> {
  let fullResponse = "";
  const isReasoning = ctx.model.includes("4.20") || ctx.model.includes("reasoning");

  // Convert custom tools to Responses API format + add web_search & x_search
  const responseTools: any[] = [
    { type: "web_search" },
    { type: "x_search" },
    ...(tools || [])
      .filter((t: any) => t?.type === "function" && t?.function?.name && t.function.name !== "search_internet")
      .map((t: any) => ({
        type: "function",
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
  ];

  let pendingInput: any[] = convertMessagesToResponsesInput(messages);

  // Clean xAI internal markup from streamed text
  function cleanGrokMarkup(text: string): string {
    return text
      .replace(/<grok:render[^>]*type="render_inline_citation"[^>]*>\s*<argument[^>]*name="citation_id"[^>]*>(\d+)<\/argument>\s*<\/grok:render>/g, '[$1]')
      .replace(/<\/?grok:render[^>]*>/g, '')
      .replace(/<argument[^>]*name="citation_id"[^>]*>(\d+)<\/argument>/g, '[$1]')
      .replace(/<\/?argument[^>]*>/g, '');
  }

  let tagBuffer = "";

  const streamDelta = async (text: string) => {
    if (!text) return;
    tagBuffer += text;
    // Buffer partial <grok:render> tags that span across deltas
    if (tagBuffer.includes("<grok:") && !tagBuffer.includes("</grok:render>")) {
      return;
    }
    const cleaned = cleanGrokMarkup(tagBuffer);
    tagBuffer = "";
    if (!cleaned) return;
    const sseData = JSON.stringify({ choices: [{ delta: { content: cleaned } }] });
    await writer.write(encoder.encode(`data: ${sseData}\n\n`));
  };
  const flushTagBuffer = async () => {
    if (tagBuffer) {
      const cleaned = cleanGrokMarkup(tagBuffer);
      tagBuffer = "";
      if (cleaned) {
        const sseData = JSON.stringify({ choices: [{ delta: { content: cleaned } }] });
        await writer.write(encoder.encode(`data: ${sseData}\n\n`));
      }
    }
  };
  const emitStatus = async (status: string) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ status })}\n\n`));
  };

  const toolStatusMap: Record<string, string> = {
    "search_sdge": "📊 Pretražujem SDGE portal...",
    "search_geoterra_app": "📋 Pretražujem GeoTerra projekte...",
    "search_drive": "📁 Pretražujem Google Drive...",
    "search_gmail": "✉️ Pretražujem Gmail...",
    "search_solo": "🧾 Pretražujem Solo račune...",
    "search_oss": "🗺️ Pretražujem OSS portal...",
    "search_trello": "📌 Pretražujem Trello...",
    "scrape_website": "🔗 Dohvaćam web stranicu...",
    "search_memory": "🧠 Pretražujem memoriju...",
    "search_knowledge": "📚 Pretražujem bazu znanja...",
    "playwright": "🌐 Kontroliram preglednik...",
    "generate_file": "📄 Generiram datoteku...",
    "generate_zip": "📦 Pakiram ZIP...",
  };

  for (let iteration = 0; iteration < 10; iteration++) {
    const inputWithSystem = iteration === 0
      ? [{ role: "system", content: systemPrompt }, ...pendingInput]
      : pendingInput;

    const requestBody: any = {
      model: ctx.model,
      input: inputWithSystem,
      tools: responseTools,
      tool_choice: "auto",
      max_output_tokens: isReasoning ? 16384 : 8192,
      stream: true,
      store: false,
      include: ["web_search_call.action.sources"],
    };

    if (isReasoning) {
      requestBody.reasoning = { effort: "high" };
    }

    // ── Retry logika (do 3 pokušaja) ──────────────
    let res: Response | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetchWithTimeout(XAI_RESPONSES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }, 180000); // 3min timeout za streaming
        if (res.ok) break;

        const errText = await res.text();
        lastError = errText;

        if (res.status !== 429 && res.status < 500) break;

        console.warn(`[Grok] Attempt ${attempt + 1} failed (${res.status}), retrying...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        res = null;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.warn(`[Grok] Attempt ${attempt + 1} error: ${lastError}, retrying...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }

    if (!res || !res.ok) {
      let detail = lastError.substring(0, 300);
      try { const j = JSON.parse(lastError); detail = j?.error?.message || detail; } catch {}
      const errMsg = `⚠️ Grok greška nakon 3 pokušaja: ${detail}`;
      await streamDelta(errMsg);
      fullResponse += errMsg;
      break;
    }

    // ── Parse SSE stream ──────────────────────────
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";
    let currentEvent = "";
    let responseText = "";
    const functionCalls: Array<{ call_id: string; name: string; arguments: string }> = [];
    const webSources: Array<{ title: string; url: string }> = [];
    let emittedWebSearchStatus = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event: ")) {
            currentEvent = trimmed.slice(7).trim();
            continue;
          }

          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;

          let data: any;
          try { data = JSON.parse(dataStr); } catch { continue; }

          switch (currentEvent) {
            // ── Text streaming (word by word) ──────
            case "response.output_text.delta": {
              const delta = data.delta || "";
              if (delta) {
                await streamDelta(delta);
                responseText += delta;
                fullResponse += delta;
              }
              break;
            }

            // ── Function call complete ─────────────
            case "response.function_call_arguments.done": {
              const callId = data.call_id || data.id || "";
              const name = data.name || "";
              const args = data.arguments || "{}";
              if (name && callId) {
                functionCalls.push({ call_id: callId, name, arguments: args });
              }
              break;
            }

            // ── Web search status ─────────────────
            case "response.web_search_call.in_progress":
            case "response.web_search_call.searching": {
              if (!emittedWebSearchStatus) {
                await emitStatus("🌐 Pretražujem web...");
                emittedWebSearchStatus = true;
              }
              break;
            }

            // ── Web search completed (sources) ────
            case "response.web_search_call.completed": {
              try {
                const sources = data?.action?.sources || data?.sources || [];
                for (const s of sources) {
                  if (s.url && s.title) webSources.push({ title: s.title, url: s.url });
                }
              } catch { /* ignore */ }
              break;
            }

            // ── Response completed ────────────────
            case "response.completed": {
              // Extract any remaining web sources from completed response
              try {
                const output = data?.response?.output || data?.output || [];
                for (const item of output) {
                  if (item.type === "web_search_call" && item.action?.sources) {
                    for (const s of item.action.sources) {
                      if (s.url && s.title && !webSources.find(ws => ws.url === s.url)) {
                        webSources.push({ title: s.title, url: s.url });
                      }
                    }
                  }
                }
              } catch { /* ignore */ }
              break;
            }
          }
        }
      }
    } catch (streamErr) {
      console.error("[Grok Stream] Error reading SSE:", streamErr);
    }

    // Flush any remaining buffered text
    await flushTagBuffer();
    fullResponse = cleanGrokMarkup(fullResponse);

    // ── Append web sources as citations ────────────
    if (webSources.length > 0 && responseText) {
      const sourcesText = "\n\n" + webSources.slice(0, 8).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join("\n");
      // Only append if not already in response
      if (!fullResponse.includes("[1]")) {
        await streamDelta(sourcesText);
        fullResponse += sourcesText;
      }
    }

    // ── If no function calls, we're done ──────────
    if (functionCalls.length === 0) break;

    // ── Execute tool calls ────────────────────────
    for (const call of functionCalls) {
      await emitStatus(toolStatusMap[call.name] || `🔍 ${call.name}...`);
    }

    const functionOutputs: any[] = await Promise.all(
      functionCalls.map(async (call) => {
        let args = {};
        try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }

        const result = await executeTool(call.name, args, ctx);
        console.log(`[Grok Tools] ${call.name} result: ${result.slice(0, 200)}`);

        const dlBlock = await injectFileDownload(call.name, result, streamDelta);
        if (dlBlock) fullResponse += dlBlock;

        let toolContent = result;
        try {
          const parsed = JSON.parse(result);
          if (parsed.display && (parsed.display.includes("![") || parsed.display.includes("data:image"))) {
            await streamDelta("\n\n" + parsed.display + "\n\n");
            fullResponse += "\n\n" + parsed.display + "\n\n";
            toolContent = JSON.stringify({ ...parsed, display: "[prikazano korisniku]" });
          }
        } catch { /* ignore */ }

        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: toolContent,
        };
      })
    );

    pendingInput = functionOutputs;
  }

  return fullResponse;
}



// ─────────────────────────────────────────────────────────────
//  GLAVNI SERVE HANDLER
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  VECTOR MEMORY — Semantičko pamćenje
// ─────────────────────────────────────────────────────────────

async function createEmbedding(text: string, openaiApiKey: string): Promise<number[] | null> {
  try {
    // Embeddings koriste OpenAI (Gemini embeddings imaju drukčiji format)
    const embeddingKey = Deno.env.get("OPENAI_API_KEY") || openaiApiKey;
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${embeddingKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
      },
      15000,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

async function searchVectorMemory(
  supabaseAdmin: any,
  userId: string,
  query: string,
  openaiApiKey: string,
  limit = 5,
): Promise<string> {
  try {
    const embedding = await createEmbedding(query, openaiApiKey);
    if (!embedding) return "";
    const { data, error } = await supabaseAdmin.rpc("search_stellan_memory", {
      query_embedding: embedding,
      match_user_id: userId,
      match_count: limit,
      min_importance: 1,
    });
    if (error || !data?.length) return "";
    const memories = data
      .filter((m: any) => m.similarity > 0.6)
      .map((m: any) => `[${m.memory_type}] ${m.content}`)
      .join("\n");
    return memories ? `\n\n====== RELEVANTNE MEMORIJE IZ SUPABASE BAZE ======\n${memories}\n====== KRAJ MEMORIJA ======` : "";
  } catch {
    return "";
  }
}


async function getRecentMemoryContext(
  supabaseAdmin: any,
  userId: string,
  limit = 12,
): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from("stellan_memory")
      .select("content, summary, memory_type, importance, created_at")
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data?.length) return "";

    const lines = data.map((m: any) => {
      const text = (m.summary || m.content || "").toString().slice(0, 220);
      return `[${m.memory_type} | važnost ${m.importance}] ${text}`;
    });

    return lines.length
      ? `\n\n====== NEDAVNE I VAŽNE MEMORIJE IZ SUPABASE BAZE ======\n${lines.join("\n")}\n====== KRAJ MEMORIJA ======`
      : "";
  } catch {
    return "";
  }
}

async function saveToVectorMemory(
  supabaseAdmin: any,
  userId: string,
  messages: any[],
  response: string,
  openaiApiKey: string,
): Promise<void> {
  try {
    // Napravi sažetak razgovora za pamćenje
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
    const userText = typeof lastUser?.content === "string" ? lastUser.content : "";
    if (!userText || userText.length < 20) return;

    const conversationText = `Korisnik: ${userText}\nStellan: ${response.slice(0, 500)}`;
    
    // Procijeni važnost (jednostavna heuristika)
    const t = userText.toLowerCase();

    // Tip memorije
    let memory_type = "conversation";
    const ideaTriggers = ["ideja", "ideju", "ideje", "što misliš", "razmišljam", "moglo bi", "zamisli", "a što ako", "imam plan", "htio bih", "planiramo", "predlažem", "kako bi bilo", "možda bi", "trebalo bi napraviti", "imao bih", "imam prijedlog"];
    const factTriggers = ["zapamti", "ne zaboravi", "uvijek", "nikad", "važno je da znaš", "bitno je"];
    const decisionTriggers = ["odlučili", "dogovorili", "zaključili", "idemo s", "odluka je", "finalno"];
    const personTriggers = ["upoznao", "radi za", "kontakt je", "zove se", "njegova email", "njena email"];

    if (ideaTriggers.some(k => t.includes(k))) memory_type = "idea";
    else if (factTriggers.some(k => t.includes(k))) memory_type = "fact";
    else if (decisionTriggers.some(k => t.includes(k))) memory_type = "decision";
    else if (personTriggers.some(k => t.includes(k))) memory_type = "person";

    // Važnost
    const highImportance = ["zapamti", "važno", "uvijek", "nikad", "odluka", "dogovor", "ideja", "plan"];
    const importance = highImportance.some(k => t.includes(k)) ? 8 : memory_type === "conversation" ? 4 : 6;

    // Preskoči trivijalne razgovore
    if (memory_type === "conversation" && userText.length < 30) return;

    const embedding = await createEmbedding(conversationText, openaiApiKey);
    if (!embedding) return;

    // Permanentno pamćenje - "zapamti zauvijek" dobiva importance 10
    const isPermanent = t.includes("zapamti zauvijek") || t.includes("nikad ne zaboravi") || t.includes("super važno");
    const finalImportance = isPermanent ? 10 : importance;

    await supabaseAdmin.from("stellan_memory").insert({
      user_id: userId,
      content: conversationText,
      summary: userText.slice(0, 200),
      memory_type,
      importance: finalImportance,
      embedding,
      metadata: { 
        conversation_length: messages.length,
        permanent: isPermanent,
      },
    });
  } catch (e) {
    console.error("Vector memory save error:", e);
  }
}


async function searchIdeasFromMemory(supabaseAdmin: any, userId: string, query: string, openaiApiKey: string): Promise<string> {
  try {
    // If specific query, use vector search
    if (query && query.length > 3) {
      const embedding = await createEmbedding(query, openaiApiKey);
      if (embedding) {
        const { data } = await supabaseAdmin.rpc("search_stellan_memory", {
          query_embedding: embedding,
          match_user_id: userId,
          match_count: 20,
          min_importance: 1,
          memory_types: ["idea"],
        });
        if (data?.length) {
          const ideas = data.map((m: any, i: number) => `${i+1}. ${m.content}`).join("\n");
          return JSON.stringify({ success: true, ideas, count: data.length });
        }
      }
    }
    // Otherwise get all ideas
    const { data } = await supabaseAdmin
      .from("stellan_memory")
      .select("content, created_at, importance, metadata")
      .eq("user_id", userId)
      .eq("memory_type", "idea")
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (!data?.length) return JSON.stringify({ success: true, ideas: "Nema spremljenih ideja.", count: 0 });
    const ideas = data.map((m: any, i: number) => `${i+1}. ${m.content} (${new Date(m.created_at).toLocaleDateString("hr")})`).join("\n");
    return JSON.stringify({ success: true, ideas, count: data.length });
  } catch (e) {
    return JSON.stringify({ success: false, error: String(e) });
  }
}


// ─────────────────────────────────────────────────────────────
//  PROAKTIVNOST — Stellan analizira memorije i predlaže akcije
// ─────────────────────────────────────────────────────────────

async function getProactiveSuggestions(
  supabaseAdmin: any,
  userId: string,
  openaiApiKey: string,
): Promise<string> {
  try {
    // Dohvati nedavne memorije visoke važnosti
    const { data: recentMemories } = await supabaseAdmin
      .from("stellan_memory")
      .select("content, memory_type, importance, created_at, metadata")
      .eq("user_id", userId)
      .gte("importance", 6)
      .not("memory_type", "eq", "daily_summary")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!recentMemories?.length) return "";

    // Provjeri stare ideje (> 7 dana bez follow-up)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldIdeas = recentMemories.filter((m: any) => 
      m.memory_type === "idea" && new Date(m.created_at) < sevenDaysAgo
    );

    const suggestions: string[] = [];

    if (oldIdeas.length > 0) {
      suggestions.push(`💡 Imaš ${oldIdeas.length} staru/e idej/e koje nisi razvio: ${oldIdeas.slice(0, 2).map((m: any) => m.summary || m.content.slice(0, 80)).join("; ")}`);
    }

    // Provjeri nedovršene odluke
    const pendingDecisions = recentMemories.filter((m: any) => m.memory_type === "decision");
    if (pendingDecisions.length > 0) {
      suggestions.push(`📋 Postoji ${pendingDecisions.length} dogovor/odluka koji treba pratiti`);
    }

    return suggestions.length > 0 
      ? `\n\n⚡ **Stellan predlaže:** ${suggestions.join(" | ")}`
      : "";
  } catch {
    return "";
  }
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── JWT auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // ←←← OVO JE NOVO I ISpravno
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

  if (userError || !user?.id) {
    console.error("[Auth] getUser failed:", userError?.message || "No user");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const user_id = user.id;

    // ── Dohvati API keys iz Secrets (fallback) ───────────────
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const SECRET_ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const SECRET_GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
    const SECRET_GROK_API_KEY = Deno.env.get("GROK_API_KEY") || "";

    const { messages, conversation_id, user_id: _client_user_id, model: requestedModel, reasoning, provider: requestedProvider, provider_model: requestedProviderModel } = await req.json();

    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ── Resolve provider & model ──────────────────────────────
    const activeProvider: string = (typeof requestedProvider === "string" && ["openai", "anthropic", "google", "xai"].includes(requestedProvider))
      ? requestedProvider
      : "xai";

    const PROVIDER_KEY_MAP: Record<string, string> = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_AI_API_KEY",
      xai: "GROK_API_KEY",
    };

    let userApiKey: string | null = null;
    const keyName = PROVIDER_KEY_MAP[activeProvider];
    if (keyName) {
      const { data: keyRow } = await supabaseAdmin
        .from("user_api_keys")
        .select("key_value")
        .eq("user_id", user_id)
        .eq("key_name", keyName)
        .maybeSingle();
      if (keyRow?.key_value) userApiKey = keyRow.key_value;
    }

    let effectiveApiKey: string;
    let effectiveModel: string;

    if (activeProvider === "openai") {
      effectiveApiKey = userApiKey || OPENAI_API_KEY;
      // Prioritiziraj provider_model iz frontenda (npr. "gpt-5.4", "gpt-5.4-mini")
      if (typeof requestedProviderModel === "string" && requestedProviderModel && OPENAI_MODELS[requestedProviderModel]) {
        effectiveModel = OPENAI_MODELS[requestedProviderModel];
      } else if (typeof requestedProviderModel === "string" && requestedProviderModel) {
        effectiveModel = requestedProviderModel;
      } else {
        const requestedKey = typeof requestedModel === "string" ? requestedModel : "";
        const modelKey = requestedKey && OPENAI_MODELS[requestedKey] ? requestedKey : (reasoning ? "smart" : OPENAI_DEFAULT);
        effectiveModel = OPENAI_MODELS[modelKey] || OPENAI_MODELS[OPENAI_DEFAULT];
      }
    } else if (activeProvider === "anthropic") {
      effectiveApiKey = userApiKey || SECRET_ANTHROPIC_API_KEY;
      effectiveModel = (typeof requestedProviderModel === "string" && requestedProviderModel)
        ? requestedProviderModel
        : (typeof requestedModel === "string" && requestedModel ? requestedModel : "claude-sonnet-4-20250514");
    } else if (activeProvider === "google") {
      effectiveApiKey = userApiKey || SECRET_GOOGLE_AI_API_KEY;
      effectiveModel = (typeof requestedProviderModel === "string" && requestedProviderModel)
        ? requestedProviderModel
        : (typeof requestedModel === "string" && requestedModel ? requestedModel : "gemini-2.5-flash");
    } else if (activeProvider === "xai") {
      effectiveApiKey = userApiKey || SECRET_GROK_API_KEY;
      effectiveModel = (typeof requestedProviderModel === "string" && requestedProviderModel)
        ? requestedProviderModel
        : (typeof requestedModel === "string" && requestedModel ? requestedModel : "grok-4-1-fast");
    } else {
      effectiveApiKey = SECRET_GROK_API_KEY || OPENAI_API_KEY;
      effectiveModel = "grok-4-1-fast";
    }

    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({ error: `API ključ za ${activeProvider} nije postavljen. Postavi ga u postavkama chata.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let geoterraToken: string | null = null;
    const geoToken = await getValidAccessToken(supabaseAdmin, user_id, "google_tokens");
    if (geoToken) geoterraToken = geoToken;

    // ── Supabase memory context ───────────────────────────────
    let recentMemories = await getRecentMemoryContext(supabaseAdmin, user_id, 12);

    let vectorMemories = "";
    const lastUserMsg = [...(messages || [])].reverse().find((m: any) => m.role === "user");
    const lastUserText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
    if (OPENAI_API_KEY && lastUserText.length > 3) {
      vectorMemories = await searchVectorMemory(supabaseAdmin, user_id, lastUserText, OPENAI_API_KEY, 10);
    }

    const memoryContext = [recentMemories, vectorMemories].filter(Boolean).join("\n");
    // ── Brain/Drive tools — dinamički check ──────────────
    let enableDriveTools = false;
    let brainAccessToken: string | null = null;
    let brainFolderIdResolved: string | null = null;
    try {
      const brainOwnerId = await resolveBrainOwnerId(supabaseAdmin, user_id);
      if (brainOwnerId) {
        const brainToken = await getValidAccessToken(supabaseAdmin, brainOwnerId, "google_brain_tokens")
          || await getValidAccessToken(supabaseAdmin, brainOwnerId, "google_tokens");
        if (brainToken) {
          // Pronađi ili kreiraj Brain folder
          const folderQ = encodeURIComponent("name='Stellan Brain' and mimeType='application/vnd.google-apps.folder' and trashed=false");
          const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${folderQ}&fields=files(id,name)`, {
            headers: { Authorization: `Bearer ${brainToken}` },
          });
          if (folderRes.ok) {
            const folderData = await folderRes.json();
            if (folderData.files?.length > 0) {
              brainFolderIdResolved = folderData.files[0].id;
              brainAccessToken = brainToken;
              enableDriveTools = true;
              console.log("[Brain] Drive tools ENABLED, folder:", brainFolderIdResolved);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Brain] Drive tools check failed, continuing without:", e);
    }
    const hasTrello = !!(Deno.env.get("TRELLO_API_KEY") && Deno.env.get("TRELLO_TOKEN"));
    const hasFirecrawl = !!Deno.env.get("FIRECRAWL_API_KEY");
    const hasGeoterraDrive = !!geoterraToken;
    const hasAgent = !!(Deno.env.get("AGENT_SERVER_URL") && sanitizeAgentServerUrl(Deno.env.get("AGENT_SERVER_URL")!));

    const providerLabel = activeProvider === "openai" ? `OpenAI (${effectiveModel})`
      : activeProvider === "anthropic" ? `Claude (${effectiveModel})`
      : activeProvider === "google" ? `Gemini (${effectiveModel})`
      : `Grok (${effectiveModel})`;

    // ── Load knowledge & tool registry from DB ───────────────
    const [knowledgeBase, toolsRegistry] = await Promise.all([
      loadStellanKnowledge(supabaseAdmin),
      loadStellanToolsRegistry(supabaseAdmin),
    ]);

    // ── System prompt ─────────────────────────────────────────
    const systemPrompt = `
Ti si Stellan — AI agent za GeoTerra Info d.o.o., hrvatsku geodetsku tvrtku.
Koristiš ${providerLabel}. Datum: ${new Date().toISOString().split("T")[0]}.

═══════════════════════════════════════════════════════
## 🧠 CORE WORKFLOW
═══════════════════════════════════════════════════════

NEJASAN zahtjev → pitaj 1-2 pitanja. JASAN → djeluj odmah.

### PRAVILA:
- Opća pitanja (novosti, proizvodi, tehnologije, sport...) → **web_search ODMAH**
- Firmeni podatci (predmeti, čestice, računi...) → interni toolovi paralelno
- Podatke TRAŽI (search/db_query/web_search) — ne govori "nemam info" bez pretrage
- Datoteke ČITAJ CIJELE prije modificiranja
- Kontekst → search_knowledge + search_memory
- Odgovori kratko kad može, detaljno kad treba
- Kod → generate_file/generate_zip, NIKAD u chat
- Pretraži SVE izvore paralelno
- Pamti važne stvari: save_knowledge + memory.md

═══════════════════════════════════════════════════════
## ⛔ APSOLUTNA ZABRANA KODA U CHATU
═══════════════════════════════════════════════════════

### ZABRANJENO — bez iznimke:
- ❌ Code blokovi (\`\`\`bilo što\`\`\`) — ZABRANJENO UVIJEK
- ❌ Snippeti, dijelovi koda, primjeri koda u tekstu — ZABRANJENO
- ❌ "Evo koda koji trebaš dodati..." — ZABRANJENO
- ❌ Pokazivanje promjena inline u poruci — ZABRANJENO

### ISPRAVNO ponašanje:
- ✅ Sav kod → generate_file ili generate_zip
- ✅ U chatu SAMO kratko objašnjenje na ljudskom jeziku
- ✅ Dozvoljeni jedino kratki \`inline\` nazivi (npr. \`useState\`, \`handleClick\`)

### SELF-CHECK prije slanja:
Ima li BILO KOJI code block (\`\`\`) u odgovoru? → OBRIŠI i stavi u generate_file.

═══════════════════════════════════════════════════════
## 📁 DATOTEKE — ČITAJ → RAZUMIJ → MODIFICIRAJ → VRATI
═══════════════════════════════════════════════════════

### Kad korisnik POŠALJE datoteku:
1. **PROČITAJ** cijeli sadržaj — razumij strukturu, importove, logiku, stilove
2. **RAZUMIJ** kontekst — zašto je datoteka takva kakva je, koje komponente koristi
3. **MODIFICIRAJ** pažljivo — napravi SAMO tražene promjene, NE diraj ono što radi
4. **VRATI** kompletnu datoteku kroz generate_file/generate_zip
5. **OBJASNI** kratko (1-3 rečenice) što si promijenio i zašto

### Kad korisnik NIJE poslao datoteku, a treba izmjenu:
→ ODMAH pitaj: "Pošalji mi [ime datoteke] da ju izmijenim."
→ NE objašnjavaj kako bi trebao ručno mijenjati

### STROGA PRAVILA:
- UVIJEK vrati CIJELU datoteku — od prvog do zadnjeg reda
- NIKAD ne piši "// ... ostatak koda ostaje isti"
- Jedna datoteka → generate_file, više datoteka → generate_zip
- NE piši linkove na datoteke u tekst — download gumb se automatski prikazuje
- Kad pišeš TypeScript/React → SVE importove, SVE funkcije, SVE exportove

═══════════════════════════════════════════════════════
## 🧠 STRUKTURIRANO PAMĆENJE
═══════════════════════════════════════════════════════

### Automatsko pamćenje:
Stellan automatski pamti svaki razgovor (vector memory). Ali za VAŽNE stvari koristi strukturirano pamćenje:

### Kad korisnik kaže "zapamti ovo" ili otkriješ nešto važno:
1. **save_knowledge** → spremi u bazu znanja s kategorijom i tagovima
2. **create_drive_file** → spremi u brain folder kao .md datoteku (ako je drive dostupan)

### Kategorije pamćenja:
- **preference** — kako korisnik želi da radiš (stil odgovora, format, pravila)
- **decision** — odluke koje su donesene (nikad ih ne mijenjaj bez pitanja)
- **fact** — činjenice o tvrtki, klijentima, procesima
- **idea** — ideje za budućnost
- **constraint** — stvari koje su zabranjene ili odbijene (nikad ih ne predlaži ponovo)

### Dohvaćanje pamćenja:
- Na početku svakog razgovora, provjeri search_knowledge za relevantne preferencije
- Kad korisnik pita nešto vezano uz prošle razgovore → search_memory
- Kad trebaš podsjetnik → read_brain_file("memory.md")

═══════════════════════════════════════════════════════
## 🔍 PRETRAGA — SVE IZVORE PARALELNO
═══════════════════════════════════════════════════════

### 🌐 WEB PRETRAGA — UVIJEK KORISTI ZA OPĆA PITANJA
Kad korisnik pita o nečemu OPĆENITOM (proizvodi, novosti, tehnologije, aplikacije, igre, cijene, vremenska prognoza, sport, politika, bilo što izvan firme):
→ **ODMAH koristi web_search** — ne čekaj, ne pitaj, pretražuj!
Primjer: "ima li novosti za app X" → web_search("app X latest news")
Primjer: "koliko košta Y" → web_search("Y price 2026")
Primjer: "što je Z" → web_search("Z")

### 🏢 FIRMENI IZVORI — za interne pretrage
Kad korisnik traži predmet, osobu, firmu, česticu po imenu u kontekstu POSLA:
OBAVEZNO pretražuj **SVE dostupne izvore** paralelno:
1. **search_sdge** — SDGE predmeti i elaborati
2. **search_geoterra_app** — kartice i projekti u aplikaciji
3. **search_trello** — Trello kartice i boardovi
4. **search_drive** — Google Drive dokumenti
5. **search_solo** — Solo.hr računi i ponude
6. **search_gmail** — mailovi vezani uz temu

### KOMBINIRAJ kad treba:
Ako nije jasno je li pitanje interno ili opće → koristi I web_search I interne izvore.
Rezultate grupiraj po izvoru. Ako neki izvor nije dostupan, preskoči ga tiho.

═══════════════════════════════════════════════════════
## 🤖 SELF-AWARENESS
═══════════════════════════════════════════════════════

Ti ZNAŠ svoju infrastrukturu i AKTIVNO je koristiš:
- **db_inspect/db_query** — pregledaj/čitaj bazu podataka
- **register_tool** — registriraj novi tool za budućnost
- **save_knowledge** — spremi znanje u bazu
- **search_knowledge** — pretraži svoju bazu znanja

Kad naučiš nešto novo → save_knowledge.
Kad napraviš novu mogućnost → register_tool.
Kad korisnik ispravi tvoju grešku → zapamti kako je izbjeći.

${toolsRegistry ? `### REGISTRIRANI TOOLOVI\n${toolsRegistry}` : ""}

═══════════════════════════════════════════════════════
## 🎯 ODGOVORI — STIL I FORMAT
═══════════════════════════════════════════════════════

### Ton:
- Profesionalan ali opušten — kao iskusan kolega
- Kratko kad je jednostavno, detaljno kad je kompleksno
- Konkretno i s akcijom — uvijek predloži sljedeći korak

### Format:
- Koristi emoji za kategorije (📊 SDGE, 📁 Drive, 📋 Trello, 🧾 Solo, ✉️ Mail)
- Rezultate pretrage grupiraj po izvoru
- Za duže odgovore koristi naslove i bullet pointove
- NIKAD ne izmišljaj podatke
- NIKAD ne laži da si nešto napravio

### Kad ne znaš odgovor:
- NIKAD ne govori "ne znam" bez da si probao (search_knowledge, web_search, db_query)
- Ako nakon pretrage nema rezultata → reci "Nisam pronašao, ali mogu pokušati [alternativa]"

═══════════════════════════════════════════════════════
## 🌐 PLAYWRIGHT — EFIKASNOST
═══════════════════════════════════════════════════════

- NE radi screenshot nakon svakog koraka (40K tokena!)
- Koristi **get_html** ili **extract** za čitanje sadržaja
- Koristi **evaluate** za JS scraping — najbrže
- Screenshot SAMO kad korisnik eksplicitno traži ili trebaš vidjeti layout
- Ulančaj akcije: navigate → fill → click → extract (bez screenshota između)

${knowledgeBase ? `═══════════════════════════════════════════════════════\n## 📚 BAZA ZNANJA\n═══════════════════════════════════════════════════════\n${knowledgeBase}` : ""}

${memoryContext ? `═══════════════════════════════════════════════════════\n## 💾 MEMORIJA\n═══════════════════════════════════════════════════════\n${memoryContext.substring(0, 15000)}` : ""}
`.substring(0, 200000);

    // ── Tools ─────────────────────────────────────────────────
    const tools = buildTools({ enableDriveTools, hasTrello, hasFirecrawl, hasGeoterraDrive, hasAgent });

    // ── Streaming response ────────────────────────────────────
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const shared = { fullResponse: "" };

    const toolCtx = {
      accessToken: brainAccessToken,
      brainFolderId: brainFolderIdResolved,
      geoterraToken,
      enableDriveTools,
      supabaseAdmin,
      user_id,
      openaiApiKey: OPENAI_API_KEY || "",
      model: effectiveModel,
    };

    const streamWork = (async () => {
      try {
        if (activeProvider === "anthropic") {
          shared.fullResponse = await runAnthropicWithTools(
            effectiveApiKey, systemPrompt, messages, tools, writer, encoder, toolCtx,
          );
        } else if (activeProvider === "google") {
          shared.fullResponse = await runGeminiWithTools(
            effectiveApiKey, systemPrompt, messages, tools, writer, encoder, toolCtx,
          );
        } else if (activeProvider === "xai") {
          shared.fullResponse = await runOpenAICompatibleWithTools(
            effectiveApiKey, "https://api.x.ai/v1/chat/completions",
            systemPrompt, messages, tools, writer, encoder, toolCtx,
          );
        } else {
          shared.fullResponse = await runOpenAIWithTools(
            effectiveApiKey, systemPrompt, messages, tools, writer, encoder, toolCtx,
          );
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
        try {
          const errDetail = e instanceof Error ? e.message : String(e);
          const errMsg = `⚠️ Greška: ${errDetail.substring(0, 300)}`;
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\n`),
          );
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch {
          /* already closed */
        }
      } finally {
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    })();

    // ── Post-conversation persistence (background) ────────────
    streamWork
      .then(async () => {
        try {
          const inputText = messages.map((m: any) => {
            if (typeof m.content === "string") return m.content;
            return "[multimodal]";
          }).join(" ");
          const outputText = shared.fullResponse || "";
          const inputTokens = Math.ceil(inputText.split(/\s+/).length * 1.3);
          const outputTokens = Math.ceil(outputText.split(/\s+/).length * 1.3);
          await supabaseAdmin
            .from("token_usage")
            .insert({
              user_id,
              conversation_id: conversation_id || null,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
              model: effectiveModel,
            });
        } catch (e) {
          console.error("Token logging error:", e);
        }

        try {
          await saveToVectorMemory(supabaseAdmin, user_id, messages, shared.fullResponse || "", OPENAI_API_KEY);
        } catch (e) {
          console.error("Vector save error:", e);
        }
      })
      .catch((e) => console.error("Persistence error:", e));

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Handler error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Nepoznata greška" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
