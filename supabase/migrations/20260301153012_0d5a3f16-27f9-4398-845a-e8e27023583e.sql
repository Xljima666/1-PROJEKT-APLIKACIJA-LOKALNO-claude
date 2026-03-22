
DROP POLICY "Users can delete own comments" ON public.comments;

CREATE POLICY "Users can delete own comments or admin all"
ON public.comments
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Users can update own comments" ON public.comments;

CREATE POLICY "Users can update own comments or admin all"
ON public.comments
FOR UPDATE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
