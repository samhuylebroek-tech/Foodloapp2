CREATE POLICY "audit_select_admin" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "ai_events_select_admin" ON public.ai_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_admin_role(uuid, public.admin_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.block_audit_mutation() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_role(uuid, public.admin_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;