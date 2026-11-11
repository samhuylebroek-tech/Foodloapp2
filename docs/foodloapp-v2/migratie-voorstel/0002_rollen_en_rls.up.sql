-- VOORSTEL — NIET UITGEVOERD. Niet in supabase/migrations zetten vóór akkoord van de eigenaar
-- en een geslaagde test op staging (zie ../SECURITY-AUDIT.md en ../MIGRATIE-VOORSTEL-ROLLEN-RLS.md).
-- Lokaal getest met tests/rls/rls-recepten.mjs en tests/rls/rls-beheer.mjs (PGlite, alle migraties).

-- 0. Nieuwe beheerrol 'finance'. ADD VALUE mag niet samen met gebruik in één transactie: apart.
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'finance';

BEGIN;

-- 1. BUG-105: recepten alleen voor eigenaar, vrienden met recipes_view en actieve gezinsleden
--    met recipes_view (has_share omvat groep_recht). Verwijderde recepten blijven verborgen.
DROP POLICY IF EXISTS recipes_select ON public.recipes;
CREATE POLICY recipes_select ON public.recipes AS PERMISSIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_share(user_id, (SELECT auth.uid()), 'recipes_view'));

-- Fotorijen: expliciet dezelfde zichtbaarheid als het recept (de subquery valt ook onder RLS).
DROP POLICY IF EXISTS "Zichtbare receptfotos lezen" ON public.recipe_photos;
CREATE POLICY "Zichtbare receptfotos lezen" ON public.recipe_photos AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_photos.recipe_id
    AND r.deleted_at IS NULL AND public.has_share(r.user_id, (SELECT auth.uid()), 'recipes_view')));

-- 2. BUG-106: opslag. De brede leesregel (hele bucket) weg. Lezen mag: eigen map, of het object
--    hoort bij een recept/fotorij die je mag zien (subqueries onder RLS), of bij Inspiratie
--    (bestaande policy recipe_photos_read_inspiratie blijft ongewijzigd).
DROP POLICY IF EXISTS recipe_photos_read ON storage.objects;
CREATE POLICY recipe_photos_read_zichtbaar ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-photos' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.image_url = objects.name)
    OR EXISTS (SELECT 1 FROM public.recipe_photos p WHERE p.path = objects.name)));
CREATE INDEX IF NOT EXISTS recipes_image_url_idx ON public.recipes (image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS recipe_photos_path_idx ON public.recipe_photos (path);

-- 3. BUG-097: geen beheerderstoegang meer via RLS. Het Control Center leest uitsluitend via
--    serverfuncties met de service-sleutel (bypasst RLS) achter bewaker() (eigenaar, rol, recht,
--    alleen-lezen, limiet, auditlog). Geen enkel clientscherm leest deze tabellen als beheerder
--    (gecontroleerd: zie MIGRATIE-VOORSTEL-ROLLEN-RLS.md §3).
-- 3a. Eigen rij blijft leesbaar; 'OR is_admin(...)' verdwijnt.
DROP POLICY IF EXISTS "aankopen_select_own" ON public.aankopen;
CREATE POLICY "aankopen_select_own" ON public.aankopen AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "app_errors_eigen_of_admin_select" ON public.app_errors;
CREATE POLICY "app_errors_eigen_of_admin_select" ON public.app_errors AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "credit_transactions_own" ON public.credit_transactions;
CREATE POLICY "credit_transactions_own" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "daily_user_stats_eigen_of_admin_select" ON public.daily_user_stats;
CREATE POLICY "daily_user_stats_eigen_of_admin_select" ON public.daily_user_stats AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "loyalty_scan_events_eigen_of_admin_select" ON public.loyalty_scan_events;
CREATE POLICY "loyalty_scan_events_eigen_of_admin_select" ON public.loyalty_scan_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "eigen meldingen lezen" ON public.notification_log;
CREATE POLICY "eigen meldingen lezen" ON public.notification_log AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "user_credits_own" ON public.user_credits;
CREATE POLICY "user_credits_own" ON public.user_credits AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "sessies_eigen_of_admin_lezen" ON public.user_sessions;
CREATE POLICY "sessies_eigen_of_admin_lezen" ON public.user_sessions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
-- 3b. Alleen-beheerder-policies: weg (service_role leest buiten RLS).
DROP POLICY IF EXISTS "audit_select_admin" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_message_recipients_select_admin" ON public.admin_message_recipients;
DROP POLICY IF EXISTS "admin_messages_select_admin" ON public.admin_messages;
DROP POLICY IF EXISTS "weergaven_admin_invoegen" ON public.admin_saved_views;
DROP POLICY IF EXISTS "weergaven_admin_lezen" ON public.admin_saved_views;
DROP POLICY IF EXISTS "weergaven_admin_verwijderen" ON public.admin_saved_views;
DROP POLICY IF EXISTS "admins read sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "ai_cache_admin_select" ON public.ai_cache;
DROP POLICY IF EXISTS "ai_events_select_admin" ON public.ai_events;
DROP POLICY IF EXISTS "ai_usage_admin" ON public.ai_usage;
DROP POLICY IF EXISTS "daily_platform_stats_admin_select" ON public.daily_platform_stats;
DROP POLICY IF EXISTS "model_prices_admin_select" ON public.model_prices;
DROP POLICY IF EXISTS "admins read usage" ON public.usage_events;
-- 3c. Gemengde policies: het publieke deel blijft, het beheerdeel verdwijnt.
DROP POLICY IF EXISTS "users read active announcements" ON public.announcements;
CREATE POLICY "users read active announcements" ON public.announcements AS PERMISSIVE FOR SELECT TO authenticated
  USING ((active AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now()))));
DROP POLICY IF EXISTS "platform_settings_read_public_keys" ON public.platform_settings;
CREATE POLICY "platform_settings_read_public_keys" ON public.platform_settings AS PERMISSIVE FOR SELECT TO authenticated
  USING ((key = ANY (ARRAY['betalen_actief'::text, 'gratis_gerechten'::text, 'pakket_gerechten'::text, 'pakket_prijs_cent'::text, 'betaalmodel'::text])));
DROP POLICY IF EXISTS "everyone reads published content" ON public.site_content;
CREATE POLICY "everyone reads published content" ON public.site_content AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (published);

-- 4. Feedback (S8): gebruiker mag eigen ticket indienen, lezen en verwijderen, maar niet
--    status/admin_note/assigned_to wijzigen. Bericht aanpassen kan zolang het ticket 'nieuw' is.
DROP POLICY IF EXISTS "Users manage own feedback" ON public.feedback;
CREATE POLICY feedback_eigen_lezen ON public.feedback FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY feedback_eigen_indienen ON public.feedback FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'nieuw' AND admin_note = '' AND assigned_to IS NULL);
CREATE POLICY feedback_eigen_verwijderen ON public.feedback FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
REVOKE UPDATE ON public.feedback FROM authenticated;
GRANT UPDATE (message) ON public.feedback TO authenticated;
CREATE POLICY feedback_eigen_aanpassen ON public.feedback FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND status = 'nieuw') WITH CHECK ((SELECT auth.uid()) = user_id AND status = 'nieuw');

-- 5. is_admin niet langer aanroepbaar door gebruikers (S7). Pas NA stap 3: geen policy gebruikt
--    het nog (anders zou elke query falen op 'permission denied for function').
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated, anon, PUBLIC;

-- 6. claim_first_admin: ongebruikt (geen app-code, functie, policy of trigger; alleen
--    service_role/postgres mochten haar nog uitvoeren). Verwijderen (S6).
DROP FUNCTION IF EXISTS public.claim_first_admin();

COMMIT;
