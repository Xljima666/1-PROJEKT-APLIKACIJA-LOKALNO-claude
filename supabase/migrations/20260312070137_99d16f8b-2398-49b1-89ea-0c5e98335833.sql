CREATE OR REPLACE FUNCTION public.prevent_created_by_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if created_by is not changing
  IF OLD.created_by IS NOT DISTINCT FROM NEW.created_by THEN
    RETURN NEW;
  END IF;
  -- Allow admins to change created_by
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Block non-admin users from changing created_by
  RAISE EXCEPTION 'Only admins can change card ownership';
END;
$$;

CREATE TRIGGER prevent_created_by_hijack_trigger
  BEFORE UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_created_by_hijack();