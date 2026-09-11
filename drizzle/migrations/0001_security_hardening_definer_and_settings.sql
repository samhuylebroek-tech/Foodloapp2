-- 1) Interne SECURITY DEFINER functies niet meer aanroepbaar via de API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.block_audit_mutation() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- 2) platform_settings niet meer publiek leesbaar
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
REVOKE SELECT ON public.platform_settings FROM anon;
GRANT SELECT ON public.platform_settings TO authenticated;

CREATE POLICY platform_settings_read_public_keys ON public.platform_settings
  FOR SELECT TO authenticated
  USING (
    key IN ('betalen_actief','gratis_gerechten','pakket_gerechten','pakket_prijs_cent','betaalmodel')
    OR public.is_admin(auth.uid())
  );
