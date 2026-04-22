import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunkKnowledgeText(text: string, maxChars = 1800, overlap = 220): string[] {
  const clean = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length && chunks.length < 120) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const paragraphBreak = clean.lastIndexOf("\n\n", end);
      const sentenceBreak = clean.lastIndexOf(". ", end);
      const softBreak = Math.max(paragraphBreak, sentenceBreak);
      if (softBreak > start + Math.floor(maxChars * 0.55)) end = softBreak + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

async function createEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

async function requireUser(req: Request, supabaseAdmin: any) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, error: "Missing authorization token" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: "Invalid authorization token" };
  return { user: data.user, error: null };
}

async function saveDocument(supabaseAdmin: any, userId: string, payload: any) {
  const title = String(payload.title || "").trim();
  const content = String(payload.content || "").trim();
  if (!title || !content) {
    return { success: false, error: "title i content su obavezni" };
  }

  const category = String(payload.category || "geodezija").trim() || "geodezija";
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
    : [];
  const sourceType = String(payload.source_type || "manual").trim() || "manual";
  const sourceUrl = payload.source_url ? String(payload.source_url).trim() : null;
  const sourceRef = String(payload.source_ref || sourceUrl || title).trim().slice(0, 500);

  const { data: source, error: sourceError } = await supabaseAdmin
    .from("stellan_knowledge_sources")
    .upsert({
      title: payload.source_title || title,
      source_type: sourceType,
      source_ref: sourceRef,
      source_url: sourceUrl,
      authority: payload.authority || null,
      official: payload.official === true,
      category,
      tags,
      metadata: payload.source_metadata || {},
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source_type,source_ref" })
    .select("id")
    .single();

  if (sourceError || !source?.id) {
    return { success: false, error: sourceError?.message || "Ne mogu spremiti izvor" };
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("stellan_knowledge_documents")
    .upsert({
      source_id: source.id,
      title,
      document_type: payload.document_type || "text",
      mime_type: payload.mime_type || "text/markdown",
      category,
      tags,
      source_url: sourceUrl,
      valid_from: payload.valid_from || null,
      valid_to: payload.valid_to || null,
      content,
      metadata: payload.metadata || {},
      created_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "source_id,title" })
    .select("id")
    .single();

  if (documentError || !document?.id) {
    return { success: false, error: documentError?.message || "Ne mogu spremiti dokument" };
  }

  await supabaseAdmin
    .from("stellan_knowledge_chunks")
    .delete()
    .eq("document_id", document.id);

  const chunks = chunkKnowledgeText(content);
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await createEmbedding(`${title}\n\n${chunk}`);
    rows.push({
      document_id: document.id,
      chunk_index: i,
      title: chunks.length === 1 ? title : `${title} (${i + 1}/${chunks.length})`,
      content: chunk,
      category,
      tags,
      token_count_estimate: Math.ceil(chunk.length / 4),
      embedding,
      metadata: {
        source_type: sourceType,
        source_url: sourceUrl,
        official: payload.official === true,
        learned_via: "stellan-knowledge",
      },
    });
  }

  const { error: chunkError } = await supabaseAdmin
    .from("stellan_knowledge_chunks")
    .insert(rows);

  if (chunkError) return { success: false, error: chunkError.message };

  return {
    success: true,
    source_id: source.id,
    document_id: document.id,
    chunks: rows.length,
    embedded_chunks: rows.filter((row) => Array.isArray(row.embedding)).length,
  };
}

async function searchCorpus(supabaseAdmin: any, payload: any) {
  const query = String(payload.query || "").trim();
  if (!query) return { success: true, results: [], count: 0 };

  const embedding = await createEmbedding(query);
  const { data, error } = await supabaseAdmin.rpc("search_stellan_knowledge_chunks", {
    query_text: query,
    query_embedding: embedding,
    match_count: Math.max(1, Math.min(Number(payload.limit) || 10, 30)),
    filter_category: payload.category || null,
    min_similarity: 0,
  });

  if (error) return { success: false, error: error.message };

  const results = (data || []).map((row: any) => ({
    chunk_id: row.chunk_id,
    document_id: row.document_id,
    title: row.document_title || row.title,
    chunk_title: row.title,
    source: row.source_title || row.source_type || "knowledge_corpus",
    source_url: row.source_url,
    authority: row.authority,
    official: row.official,
    category: row.category,
    tags: row.tags || [],
    similarity: typeof row.similarity === "number" ? Number(row.similarity.toFixed(4)) : row.similarity,
    content: String(row.content || "").slice(0, 1800),
    page_start: row.page_start,
    page_end: row.page_end,
  }));

  return { success: true, results, count: results.length };
}

async function listDocuments(supabaseAdmin: any, payload: any) {
  let query = supabaseAdmin
    .from("stellan_knowledge_documents")
    .select(`
      id,
      title,
      document_type,
      category,
      tags,
      source_url,
      created_at,
      updated_at,
      source:stellan_knowledge_sources (
        title,
        source_type,
        authority,
        official,
        source_url
      )
    `)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(Number(payload.limit) || 20, 100)));

  if (payload.category) query = query.eq("category", payload.category);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, documents: data || [], count: data?.length || 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ success: false, error: "Supabase service env nije konfiguriran" }, 500);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { user, error: authError } = await requireUser(req, supabaseAdmin);
  if (authError || !user) return jsonResponse({ success: false, error: authError }, 401);

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "").trim();

    if (action === "save_document") {
      return jsonResponse(await saveDocument(supabaseAdmin, user.id, payload));
    }
    if (action === "search") {
      return jsonResponse(await searchCorpus(supabaseAdmin, payload));
    }
    if (action === "list_documents") {
      return jsonResponse(await listDocuments(supabaseAdmin, payload));
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 500);
  }
});
