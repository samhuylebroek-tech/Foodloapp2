-- 1. Credit-functies mogen nooit rechtstreeks door de app/gebruiker worden aangeroepen.
REVOKE ALL ON FUNCTION public.credits_account(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_afronden(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_reserveren(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_terugstorten(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_toekennen(uuid, integer, text, text) FROM anon, authenticated;

-- 2. Triggerfuncties horen niet aanroepbaar te zijn.
REVOKE ALL ON FUNCTION public.admin_users_only_owner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.check_recipe_limit() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.groep_eigenaar_lid() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_mutation() FROM anon, authenticated;

-- 3. Niet-aangemelde bezoekers hebben geen enkele definer-functie nodig.
REVOKE ALL ON FUNCTION public.groep_naam(text) FROM anon;
REVOKE ALL ON FUNCTION public.join_group(text) FROM anon;
REVOKE ALL ON FUNCTION public.in_groep(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.samen_in_groep(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.groep_recht(uuid, uuid, text) FROM anon;

-- 4. Een gezinslid mag zichzelf geen eigenaarsrol geven.
CREATE OR REPLACE FUNCTION public.group_members_geen_rolwissel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _eigenaar uuid;
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    SELECT owner_id INTO _eigenaar FROM public.groups WHERE id = OLD.group_id;
    IF auth.uid() IS DISTINCT FROM _eigenaar THEN
      RAISE EXCEPTION 'Alleen de eigenaar van het gezin kan rollen aanpassen.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.group_members_geen_rolwissel() FROM anon, authenticated;

DROP TRIGGER IF EXISTS group_members_geen_rolwissel_trg ON public.group_members;
CREATE TRIGGER group_members_geen_rolwissel_trg
BEFORE UPDATE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.group_members_geen_rolwissel();