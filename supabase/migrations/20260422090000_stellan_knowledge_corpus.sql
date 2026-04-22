-- Stellan Knowledge Corpus v1
-- Source-backed document knowledge for geodesy, elaborati, SDGE/OSS/PDF workflows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.stellan_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_ref text NOT NULL,
  source_url text,
  authority text,
  official boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_ref)
);

CREATE TABLE IF NOT EXISTS public.stellan_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.stellan_knowledge_sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'text',
  mime_type text,
  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_url text,
  valid_from date,
  valid_to date,
  content text NOT NULL DEFAULT '',
  content_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, title)
);

CREATE TABLE IF NOT EXISTS public.stellan_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.stellan_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  title text,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  page_start integer,
  page_end integer,
  token_count_estimate integer,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED,
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_sources_category
  ON public.stellan_knowledge_sources (category);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_documents_category
  ON public.stellan_knowledge_documents (category);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_chunks_category
  ON public.stellan_knowledge_chunks (category);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_chunks_search
  ON public.stellan_knowledge_chunks USING gin (search_text);

CREATE INDEX IF NOT EXISTS idx_stellan_knowledge_chunks_embedding
  ON public.stellan_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

ALTER TABLE public.stellan_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stellan_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stellan_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read stellan knowledge sources" ON public.stellan_knowledge_sources;
CREATE POLICY "Authenticated users can read stellan knowledge sources"
  ON public.stellan_knowledge_sources
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read stellan knowledge documents" ON public.stellan_knowledge_documents;
CREATE POLICY "Authenticated users can read stellan knowledge documents"
  ON public.stellan_knowledge_documents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can read stellan knowledge chunks" ON public.stellan_knowledge_chunks;
CREATE POLICY "Authenticated users can read stellan knowledge chunks"
  ON public.stellan_knowledge_chunks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.stellan_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stellan_knowledge_sources_touch_updated_at ON public.stellan_knowledge_sources;
CREATE TRIGGER stellan_knowledge_sources_touch_updated_at
  BEFORE UPDATE ON public.stellan_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.stellan_touch_updated_at();

DROP TRIGGER IF EXISTS stellan_knowledge_documents_touch_updated_at ON public.stellan_knowledge_documents;
CREATE TRIGGER stellan_knowledge_documents_touch_updated_at
  BEFORE UPDATE ON public.stellan_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.stellan_touch_updated_at();

DROP TRIGGER IF EXISTS stellan_knowledge_chunks_touch_updated_at ON public.stellan_knowledge_chunks;
CREATE TRIGGER stellan_knowledge_chunks_touch_updated_at
  BEFORE UPDATE ON public.stellan_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.stellan_touch_updated_at();

CREATE OR REPLACE FUNCTION public.search_stellan_knowledge_chunks(
  query_text text,
  query_embedding vector(1536) DEFAULT NULL,
  match_count integer DEFAULT 8,
  filter_category text DEFAULT NULL,
  min_similarity double precision DEFAULT 0
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  source_id uuid,
  title text,
  document_title text,
  source_title text,
  source_type text,
  source_url text,
  authority text,
  official boolean,
  category text,
  tags text[],
  content text,
  similarity double precision,
  page_start integer,
  page_end integer,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q tsquery;
BEGIN
  q := CASE
    WHEN nullif(trim(coalesce(query_text, '')), '') IS NULL THEN NULL
    ELSE websearch_to_tsquery('simple', query_text)
  END;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    d.id AS document_id,
    s.id AS source_id,
    c.title,
    d.title AS document_title,
    s.title AS source_title,
    s.source_type,
    coalesce(c.metadata->>'source_url', d.source_url, s.source_url) AS source_url,
    s.authority,
    s.official,
    coalesce(c.category, d.category, s.category) AS category,
    coalesce(c.tags, d.tags, s.tags) AS tags,
    c.content,
    CASE
      WHEN query_embedding IS NOT NULL AND c.embedding IS NOT NULL THEN 1 - (c.embedding <=> query_embedding)
      WHEN q IS NOT NULL THEN ts_rank_cd(c.search_text, q)::double precision
      ELSE 0
    END AS similarity,
    c.page_start,
    c.page_end,
    c.metadata
  FROM public.stellan_knowledge_chunks c
  JOIN public.stellan_knowledge_documents d ON d.id = c.document_id
  LEFT JOIN public.stellan_knowledge_sources s ON s.id = d.source_id
  WHERE
    (filter_category IS NULL OR filter_category = '' OR c.category = filter_category OR d.category = filter_category OR s.category = filter_category)
    AND (
      q IS NULL
      OR c.search_text @@ q
      OR c.content ILIKE '%' || query_text || '%'
      OR d.title ILIKE '%' || query_text || '%'
      OR s.title ILIKE '%' || query_text || '%'
      OR (query_embedding IS NOT NULL AND c.embedding IS NOT NULL)
    )
    AND (
      min_similarity <= 0
      OR query_embedding IS NULL
      OR c.embedding IS NULL
      OR 1 - (c.embedding <=> query_embedding) >= min_similarity
    )
  ORDER BY
    CASE WHEN query_embedding IS NOT NULL AND c.embedding IS NOT NULL THEN c.embedding <=> query_embedding END ASC NULLS LAST,
    CASE WHEN q IS NOT NULL THEN ts_rank_cd(c.search_text, q) ELSE 0 END DESC,
    d.updated_at DESC
  LIMIT greatest(1, least(coalesce(match_count, 8), 30));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_stellan_knowledge_chunks(text, vector, integer, text, double precision)
  TO authenticated, service_role;

-- Repo-owned schema for the vector memory that the chat function already expects.
CREATE TABLE IF NOT EXISTS public.stellan_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  summary text,
  memory_type text NOT NULL DEFAULT 'conversation',
  importance integer NOT NULL DEFAULT 4,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stellan_memory
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'conversation',
  ADD COLUMN IF NOT EXISTS importance integer DEFAULT 4,
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_stellan_memory_user_type
  ON public.stellan_memory (user_id, memory_type, importance DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stellan_memory_embedding
  ON public.stellan_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

ALTER TABLE public.stellan_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own stellan memory" ON public.stellan_memory;
CREATE POLICY "Users can read own stellan memory"
  ON public.stellan_memory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.search_stellan_memory(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count integer DEFAULT 10,
  min_importance integer DEFAULT 1,
  memory_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  summary text,
  memory_type text,
  importance integer,
  metadata jsonb,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    m.content,
    m.summary,
    m.memory_type,
    m.importance,
    m.metadata,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.stellan_memory m
  WHERE
    m.user_id = match_user_id
    AND m.embedding IS NOT NULL
    AND m.importance >= coalesce(min_importance, 1)
    AND (memory_types IS NULL OR m.memory_type = ANY(memory_types))
  ORDER BY m.embedding <=> query_embedding
  LIMIT greatest(1, least(coalesce(match_count, 10), 50));
$$;

GRANT EXECUTE ON FUNCTION public.search_stellan_memory(vector, uuid, integer, integer, text[])
  TO authenticated, service_role;

-- Seed the corpus from the existing lightweight knowledge table so old knowledge
-- remains searchable even before real PDF/document ingestion starts.
INSERT INTO public.stellan_knowledge_sources (
  title,
  source_type,
  source_ref,
  authority,
  official,
  category,
  tags,
  metadata
)
VALUES (
  'Existing Stellan operational knowledge',
  'migration',
  'stellan_knowledge_seed',
  'GeoTerra internal',
  false,
  'geodezija',
  ARRAY['stellan', 'geodezija', 'seed'],
  '{"origin":"stellan_knowledge"}'::jsonb
)
ON CONFLICT (source_type, source_ref)
DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();

INSERT INTO public.stellan_knowledge_documents (
  source_id,
  title,
  document_type,
  mime_type,
  category,
  tags,
  content,
  metadata
)
SELECT
  s.id,
  k.title,
  'knowledge_note',
  'text/markdown',
  coalesce(k.category, 'general'),
  coalesce(k.tags, ARRAY[]::text[]),
  k.content,
  jsonb_build_object('origin_table', 'stellan_knowledge', 'origin_id', k.id)
FROM public.stellan_knowledge k
CROSS JOIN public.stellan_knowledge_sources s
WHERE s.source_type = 'migration'
  AND s.source_ref = 'stellan_knowledge_seed'
ON CONFLICT (source_id, title)
DO UPDATE SET
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  content = EXCLUDED.content,
  updated_at = now();

INSERT INTO public.stellan_knowledge_chunks (
  document_id,
  chunk_index,
  title,
  content,
  category,
  tags,
  token_count_estimate,
  metadata
)
SELECT
  d.id,
  0,
  d.title,
  d.content,
  d.category,
  d.tags,
  greatest(1, length(d.content) / 4),
  jsonb_build_object('seeded_from', 'stellan_knowledge')
FROM public.stellan_knowledge_documents d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.stellan_knowledge_chunks c
  WHERE c.document_id = d.id
    AND c.chunk_index = 0
);
