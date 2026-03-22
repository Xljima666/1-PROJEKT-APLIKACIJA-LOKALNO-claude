
-- Add archived column to workspace_items for soft-delete/archive functionality
ALTER TABLE public.workspace_items ADD COLUMN archived boolean NOT NULL DEFAULT false;
