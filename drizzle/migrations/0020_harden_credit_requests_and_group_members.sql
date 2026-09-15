-- 1. credit_requests: gebruikers mogen enkel een neutrale aanvraag indienen
DROP POLICY IF EXISTS "eigen aanvraag indienen" ON public.credit_requests;
CREATE POLICY "eigen aanvraag indienen"
ON public.credit_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'open'
  AND toegekend = 0
  AND admin_note = ''
  AND handled_by IS NULL
  AND handled_at IS NULL
  AND aantal > 0 AND aantal <= 1000
);

-- 2. group_members: leden mogen enkel hun eigen deel-instellingen wijzigen
CREATE OR REPLACE FUNCTION public.group_members_alleen_eigen_delen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _eigenaar uuid;
BEGIN
  SELECT owner_id INTO _eigenaar FROM public.groups WHERE id = OLD.group_id;
  IF auth.uid() IS DISTINCT FROM _eigenaar THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Alleen de eigenaar van het gezin kan dit aanpassen.';
    END IF;
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Je kan enkel je eigen instellingen aanpassen.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS group_members_alleen_eigen_delen_trg ON public.group_members;
CREATE TRIGGER group_members_alleen_eigen_delen_trg
BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.group_members_alleen_eigen_delen();

DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
CREATE POLICY "group_members_update"
ON public.group_members FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
);