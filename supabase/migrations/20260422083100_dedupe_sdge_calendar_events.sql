-- Remove duplicate SDGE calendar rows that were created by unstable sync keys.
WITH ranked_sdge_events AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, event_date, title, coalesce(description, '')
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.calendar_events
  WHERE description LIKE '[SDGE]%'
)
DELETE FROM public.calendar_events calendar_event
USING ranked_sdge_events ranked
WHERE calendar_event.id = ranked.id
  AND ranked.duplicate_rank > 1;

-- Keep future SDGE syncs idempotent even if the edge function is run repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_sdge_unique_idx
ON public.calendar_events (user_id, event_date, title, coalesce(description, ''))
WHERE description LIKE '[SDGE]%';
