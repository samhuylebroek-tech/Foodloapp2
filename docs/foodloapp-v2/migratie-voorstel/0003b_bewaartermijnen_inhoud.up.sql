-- VOORSTEL — NIET UITGEVOERD. Aanvulling op 0003: bewaartermijnen voor inhoud en contact
-- (AVG-BEWAARTERMIJNEN-VOORSTEL.md §1–§3). Termijnen zijn een voorstel; de eigenaar kiest.
-- Lokaal getest met tests/rls/bewaartermijnen-inhoud.mjs (PGlite).
-- NIET in dit voorstel: inactieve accounts (beslissing eigenaar open) en het wissen van
-- foto-bestanden in de opslag bij definitief verwijderde recepten (dat vraagt een serverjob met
-- dezelfde regels als ruimFotosOp: alleen bestanden die niemand anders nog gebruikt).

BEGIN;

CREATE OR REPLACE FUNCTION public.ruim_inhoud_op()
RETURNS TABLE (tabel text, aantal bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  -- Prullenbak: 30 dagen na "verwijderen" definitief weg (ingrediënten en versies via cascade).
  DELETE FROM public.recipes WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'recipes prullenbak (gewist)'; aantal := n; RETURN NEXT;

  -- Receptversies: de laatste 20 per recept blijven.
  DELETE FROM public.recipe_versions v USING (
    SELECT id, row_number() OVER (PARTITION BY recipe_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.recipe_versions
  ) r WHERE v.id = r.id AND r.rn > 20;
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'recipe_versions (> 20, gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.meal_plan WHERE plan_date < (current_date - interval '12 months')::date;
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'meal_plan (> 12 maanden, gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.shopping_history WHERE gekocht_op < now() - interval '24 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'shopping_history (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.shares WHERE status = 'pending' AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'shares open uitnodiging (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.ai_cache WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'ai_cache (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.feedback
   WHERE status IN ('opgelost', 'gesloten') AND coalesce(updated_at, created_at) < now() - interval '24 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'feedback afgehandeld (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.push_subscriptions
   WHERE actief = false OR coalesce(last_ok_at, created_at) < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'push_subscriptions (gewist)'; aantal := n; RETURN NEXT;

  DELETE FROM public.admin_sessions WHERE last_seen_at < now() - interval '13 months';
  GET DIAGNOSTICS n = ROW_COUNT; tabel := 'admin_sessions (gewist)'; aantal := n; RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.ruim_inhoud_op() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruim_inhoud_op() TO service_role;

COMMIT;

SELECT cron.schedule('foodlo-bewaartermijnen-inhoud', '45 3 * * 1', $$SELECT public.ruim_inhoud_op()$$);
