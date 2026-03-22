CREATE POLICY "Admins can delete contact submissions"
  ON public.contact_submissions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));