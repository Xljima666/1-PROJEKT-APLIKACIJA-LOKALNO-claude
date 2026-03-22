ALTER TABLE public.boards ADD COLUMN position INTEGER DEFAULT 0;

-- Set initial positions based on created_at order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS pos
  FROM public.boards
)
UPDATE public.boards SET position = numbered.pos FROM numbered WHERE boards.id = numbered.id;