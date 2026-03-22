CREATE POLICY "Users with kontakt-upiti permission can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_tab_permissions
    WHERE user_tab_permissions.user_id = auth.uid()
    AND user_tab_permissions.tab_key = 'kontakt-upiti'
  )
);