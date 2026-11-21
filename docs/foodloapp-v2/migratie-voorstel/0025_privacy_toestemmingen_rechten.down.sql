-- Terugdraaien van voorstel 0025 (NIET UITGEVOERD). Zet exact de huidige stand terug:
-- groep_recht zoals in drizzle 0024 (rechten van de eigenaar), geen toestemmingen, geen
-- sessiefuncties. Let op: dit opent BUG-164 opnieuw.

BEGIN;

DROP FUNCTION IF EXISTS public.meld_aanmelding_af(uuid);
DROP FUNCTION IF EXISTS public.mijn_aanmeldingen();

DROP TABLE IF EXISTS public.toestemmingen;
DROP FUNCTION IF EXISTS public.toestemming_vast_eigenaar();

CREATE OR REPLACE FUNCTION public.groep_recht(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members o
    JOIN public.group_members v ON v.group_id = o.group_id AND v.user_id = _viewer AND v.status = 'actief'
    WHERE o.user_id = _owner AND o.status = 'actief'
      AND CASE _perm
        WHEN 'recipes_view'  THEN o.recipes_view OR o.recipes_edit
        WHEN 'recipes_edit'  THEN o.recipes_edit
        WHEN 'planner_view'  THEN o.planner_view OR o.planner_edit
        WHEN 'planner_edit'  THEN o.planner_edit
        WHEN 'shopping_view' THEN o.shopping_view OR o.shopping_edit
        WHEN 'shopping_edit' THEN o.shopping_edit
        ELSE false END
  );
$$;

COMMIT;
