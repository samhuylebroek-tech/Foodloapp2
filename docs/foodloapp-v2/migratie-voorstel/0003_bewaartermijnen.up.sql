-- VOORSTEL — NIET UITGEVOERD. Bewaartermijnen voor telemetrie (BUG-109, AVG art. 5.1.e).
-- Termijnen zijn een voorstel; de eigenaar kiest ze (zie ../AVG-AUDIT.md §7) en ze komen in het
-- privacybeleid. Lokaal getest met tests/rls/bewaartermijnen.mjs (PGlite).
-- Werkwijze: gedragsgegevens na de termijn WISSEN; kosten-/importregels behouden maar
-- PSEUDONIMISEREN (user_id leeg), zodat totalen kloppen zonder persoon.

BEGIN;

CREATE OR REPLACE FUNCTION public.ruim_telemetrie_op()
RETURNS TABLE (tabel text, aantal bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM public.usage_events WHERE created_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'usage_events (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.user_sessions WHERE last_seen_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'user_sessions (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.app_errors WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'app_errors (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.notification_log WHERE created_at < now() - interval '6 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'notification_log (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.daily_user_stats WHERE dag < (now() - interval '25 months')::date;
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'daily_user_stats (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.admin_rate_limits WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'admin_rate_limits (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.ai_events WHERE created_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'ai_events (gewist)'; aantal := n; RETURN NEXT;

  UPDATE public.ai_usage SET user_id = NULL
   WHERE user_id IS NOT NULL AND created_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'ai_usage (gepseudonimiseerd)'; aantal := n; RETURN NEXT;

  UPDATE public.recipe_import_jobs SET user_id = NULL
   WHERE user_id IS NOT NULL AND created_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'recipe_import_jobs (gepseudonimiseerd)'; aantal := n; RETURN NEXT;

  UPDATE public.loyalty_scan_events SET user_id = NULL
   WHERE user_id IS NOT NULL AND created_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'loyalty_scan_events (gepseudonimiseerd)'; aantal := n; RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.ruim_telemetrie_op() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruim_telemetrie_op() TO service_role;

COMMIT;

-- Wekelijks uitvoeren (pg_cron, maandag 03:30 UTC). Apart, zodat de functie ook zonder cron kan.
SELECT cron.schedule('foodlo-bewaartermijnen', '30 3 * * 1', $$SELECT public.ruim_telemetrie_op()$$);
