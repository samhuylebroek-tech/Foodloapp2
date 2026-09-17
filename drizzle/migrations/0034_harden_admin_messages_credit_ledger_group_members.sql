-- 1. admin_messages / admin_message_recipients: explicit admin-only read access
CREATE POLICY "admin_messages_select_admin"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_message_recipients_select_admin"
  ON public.admin_message_recipients FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- writes stay service-role only: block them even if a permissive policy is added later
CREATE POLICY "admin_messages_no_write_ins" ON public.admin_messages
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "admin_messages_no_write_upd" ON public.admin_messages
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "admin_messages_no_write_del" ON public.admin_messages
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "admin_message_recipients_no_write_ins" ON public.admin_message_recipients
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "admin_message_recipients_no_write_upd" ON public.admin_message_recipients
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "admin_message_recipients_no_write_del" ON public.admin_message_recipients
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

GRANT SELECT ON public.admin_messages TO authenticated;
GRANT SELECT ON public.admin_message_recipients TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
GRANT ALL ON public.admin_message_recipients TO service_role;

-- 2. credit_transactions: ledger is append-only via service role; hard-block client writes
CREATE POLICY "credit_transactions_no_insert" ON public.credit_transactions
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "credit_transactions_no_update" ON public.credit_transactions
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "credit_transactions_no_delete" ON public.credit_transactions
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 3. group_members: members may only accept/decline their own invitation,
--    never move rows or change owner/group/user identity.
CREATE OR REPLACE FUNCTION public.group_members_geen_zelf_escalatie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eigenaar uuid;
BEGIN
  SELECT g.owner_id INTO eigenaar FROM public.groups g WHERE g.id = OLD.group_id;

  IF eigenaar = auth.uid() THEN
    -- eigenaar mag beheren, maar de rij mag niet naar een andere groep/gebruiker verhuizen
    IF NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Lidmaatschap kan niet verplaatst worden';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    IF NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.recipes_view IS DISTINCT FROM OLD.recipes_view
       OR NEW.recipes_edit IS DISTINCT FROM OLD.recipes_edit
       OR NEW.planner_view IS DISTINCT FROM OLD.planner_view
       OR NEW.planner_edit IS DISTINCT FROM OLD.planner_edit
       OR NEW.shopping_view IS DISTINCT FROM OLD.shopping_view
       OR NEW.shopping_edit IS DISTINCT FROM OLD.shopping_edit THEN
      RAISE EXCEPTION 'Je kan je eigen rol of rechten niet aanpassen';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'uitgenodigd' AND NEW.status IN ('actief', 'geweigerd')) THEN
      RAISE EXCEPTION 'Alleen een uitnodiging aanvaarden of weigeren is toegestaan';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Geen toegang tot dit lidmaatschap';
END;
$$;

DROP TRIGGER IF EXISTS group_members_geen_zelf_escalatie ON public.group_members;
CREATE TRIGGER group_members_geen_zelf_escalatie
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.group_members_geen_zelf_escalatie();

REVOKE ALL ON FUNCTION public.group_members_geen_zelf_escalatie() FROM public, anon;