
-- Create sdge_notifications table
CREATE TABLE public.sdge_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sdge_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'terenski_uvidaj',
  event_date DATE,
  elaborat_number TEXT,
  raw_data JSONB,
  synced_to_calendar BOOLEAN NOT NULL DEFAULT false,
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sdge_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own sdge_notifications"
ON public.sdge_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sdge_notifications"
ON public.sdge_notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sdge_notifications"
ON public.sdge_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sdge_notifications"
ON public.sdge_notifications FOR DELETE
USING (auth.uid() = user_id);

-- Service role needs access for the edge function (which uses service role key)
CREATE POLICY "Service role full access on sdge_notifications"
ON public.sdge_notifications FOR ALL
USING (true)
WITH CHECK (true);
