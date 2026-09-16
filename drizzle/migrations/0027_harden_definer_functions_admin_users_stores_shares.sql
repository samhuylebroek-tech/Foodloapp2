REVOKE EXECUTE ON FUNCTION public.accepteer_gezin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nodig_gezinslid(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accepteer_gezin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nodig_gezinslid(uuid, uuid) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;
DROP POLICY IF EXISTS admin_users_geen_schrijven ON public.admin_users;
CREATE POLICY admin_users_geen_schrijven
  ON public.admin_users
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (false);

DROP POLICY IF EXISTS loyalty_stores_read ON public.loyalty_stores;
CREATE POLICY loyalty_stores_read
  ON public.loyalty_stores
  FOR SELECT
  TO authenticated
  USING (actief);
REVOKE SELECT ON public.loyalty_stores FROM anon;

REVOKE ALL ON public.shares FROM anon;
DROP POLICY IF EXISTS shares_member_select ON public.shares;
CREATE POLICY shares_member_select
  ON public.shares
  FOR SELECT
  TO authenticated
  USING (member_id IS NOT NULL AND auth.uid() = member_id);
DROP POLICY IF EXISTS shares_member_delete ON public.shares;
CREATE POLICY shares_member_delete
  ON public.shares
  FOR DELETE
  TO authenticated
  USING (member_id IS NOT NULL AND auth.uid() = member_id);