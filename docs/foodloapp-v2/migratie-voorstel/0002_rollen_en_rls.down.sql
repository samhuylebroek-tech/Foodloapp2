-- Terugdraaien van 0002_rollen_en_rls.up.sql. Herstelt exact de policies zoals PostgreSQL ze
-- rapporteerde na alle migraties in de repo (pg_policies, PGlite). Opgelet: dit heropent BUG-105,
-- BUG-106 en BUG-097. Alleen gebruiken als de nieuwe regels iets wezenlijks breken.
-- De enumwaarde 'finance' blijft bestaan (PostgreSQL kan een enumwaarde niet weghalen); dat is
-- onschadelijk zolang geen rij die rol heeft. Zet zulke rijen eerst terug naar een andere rol.

BEGIN;
DROP POLICY IF EXISTS recipes_select ON public.recipes;
DROP POLICY IF EXISTS "Zichtbare receptfotos lezen" ON public.recipe_photos;
DROP POLICY IF EXISTS recipe_photos_read_zichtbaar ON storage.objects;
DROP INDEX IF EXISTS public.recipes_image_url_idx;
DROP INDEX IF EXISTS public.recipe_photos_path_idx;
DROP POLICY IF EXISTS "aankopen_select_own" ON public.aankopen;
DROP POLICY IF EXISTS "app_errors_eigen_of_admin_select" ON public.app_errors;
DROP POLICY IF EXISTS "credit_transactions_own" ON public.credit_transactions;
DROP POLICY IF EXISTS "daily_user_stats_eigen_of_admin_select" ON public.daily_user_stats;
DROP POLICY IF EXISTS "loyalty_scan_events_eigen_of_admin_select" ON public.loyalty_scan_events;
DROP POLICY IF EXISTS "eigen meldingen lezen" ON public.notification_log;
DROP POLICY IF EXISTS "user_credits_own" ON public.user_credits;
DROP POLICY IF EXISTS "sessies_eigen_of_admin_lezen" ON public.user_sessions;
DROP POLICY IF EXISTS "users read active announcements" ON public.announcements;
DROP POLICY IF EXISTS "platform_settings_read_public_keys" ON public.platform_settings;
DROP POLICY IF EXISTS "everyone reads published content" ON public.site_content;
DROP POLICY IF EXISTS feedback_eigen_lezen ON public.feedback;
DROP POLICY IF EXISTS feedback_eigen_indienen ON public.feedback;
DROP POLICY IF EXISTS feedback_eigen_verwijderen ON public.feedback;
DROP POLICY IF EXISTS feedback_eigen_aanpassen ON public.feedback;
GRANT UPDATE ON public.feedback TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

CREATE POLICY "aankopen_select_own" ON public.aankopen AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "audit_select_admin" ON public.admin_audit_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "admin_message_recipients_select_admin" ON public.admin_message_recipients AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "admin_messages_select_admin" ON public.admin_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "weergaven_admin_invoegen" ON public.admin_saved_views AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((is_admin(auth.uid()) AND (admin_id = auth.uid())));
CREATE POLICY "weergaven_admin_lezen" ON public.admin_saved_views AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_admin(auth.uid()) AND (admin_id = auth.uid())));
CREATE POLICY "weergaven_admin_verwijderen" ON public.admin_saved_views AS PERMISSIVE FOR DELETE TO authenticated
  USING ((is_admin(auth.uid()) AND (admin_id = auth.uid())));
CREATE POLICY "admins read sessions" ON public.admin_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "ai_cache_admin_select" ON public.ai_cache AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "ai_events_select_admin" ON public.ai_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "ai_usage_admin" ON public.ai_usage AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "users read active announcements" ON public.announcements AS PERMISSIVE FOR SELECT TO authenticated
  USING (((active AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now()))) OR is_admin(auth.uid())));
CREATE POLICY "app_errors_eigen_of_admin_select" ON public.app_errors AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "credit_transactions_own" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "daily_platform_stats_admin_select" ON public.daily_platform_stats AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "daily_user_stats_eigen_of_admin_select" ON public.daily_user_stats AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "Users manage own feedback" ON public.feedback AS PERMISSIVE FOR ALL TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "loyalty_scan_events_eigen_of_admin_select" ON public.loyalty_scan_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "model_prices_admin_select" ON public.model_prices AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "eigen meldingen lezen" ON public.notification_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "recipe_photos_read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'recipe-photos'::text));
CREATE POLICY "platform_settings_read_public_keys" ON public.platform_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((key = ANY (ARRAY['betalen_actief'::text, 'gratis_gerechten'::text, 'pakket_gerechten'::text, 'pakket_prijs_cent'::text, 'betaalmodel'::text])) OR is_admin(auth.uid())));
CREATE POLICY "Zichtbare receptfotos lezen" ON public.recipe_photos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes WHERE (recipes.id = recipe_photos.recipe_id))));
CREATE POLICY "recipes_select" ON public.recipes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((deleted_at IS NULL));
CREATE POLICY "everyone reads published content" ON public.site_content AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((published OR is_admin(auth.uid())));
CREATE POLICY "admins read usage" ON public.usage_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));
CREATE POLICY "user_credits_own" ON public.user_credits AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));
CREATE POLICY "sessies_eigen_of_admin_lezen" ON public.user_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_admin(auth.uid())));

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aantal integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO aantal FROM public.admin_users;
  IF aantal > 0 THEN RETURN false; END IF;
  INSERT INTO public.admin_users (user_id, role, active, can_view_private_content, note, created_by)
  VALUES (auth.uid(), 'super_admin', true, true, 'Eerste beheerder', auth.uid());
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;
COMMIT;
