-- VOORSTEL — NIET UITGEVOERD. P3 Na het koken: "Gekookt" en een eigen notitie bij het recept.
--
-- kookmomenten (één rij per keer dat je iets kookte):
-- - optioneel de geplande maaltijd (meal_plan) en het recept, het aantal porties en een korte
--   eigen notitie (hooguit 500 tekens, vrije tekst; de app stuurt ze nooit naar AI);
-- - één moment per geplande maaltijd per gebruiker (opnieuw "Gekookt" werkt het bij);
-- - alleen de eigen rijen zijn leesbaar en schrijfbaar: geen gezin, geen vrienden. Een notitie
--   is persoonlijk. (Gezinsleden zien "gekookt" dus nog niet; dat vraagt een aparte beslissing.)
-- - je kan alleen een maaltijd of recept koppelen dat je zelf mag zien (de controle loopt via de
--   bestaande RLS van meal_plan en recipes);
-- - recept weg = notities weg (CASCADE); maaltijd weg = moment blijft zonder koppeling.
--
-- Receptversies hebben GEEN nieuwe tabel nodig: public.recipe_versions bestaat al in productie
-- (drizzle 0030/0036). De reden en de wijziging staan in `momentopname` (jsonb). De test hieronder
-- controleert dat ook die rechten doen wat de app verwacht.
--
-- De app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en bewaart
-- anders op het toestel. Lokaal getest met tests/rls/kookmomenten.mjs (PGlite).
-- Terugdraaien: 0015_kookmomenten.down.sql.

BEGIN;

CREATE TABLE public.kookmomenten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  meal_plan_id uuid REFERENCES public.meal_plan(id) ON DELETE SET NULL,
  gekookt_op timestamptz NOT NULL DEFAULT now(),
  porties smallint CHECK (porties IS NULL OR (porties >= 1 AND porties <= 50)),
  notitie text CHECK (notitie IS NULL OR (length(notitie) >= 1 AND length(notitie) <= 500)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX kookmomenten_een_per_maaltijd
  ON public.kookmomenten (user_id, meal_plan_id) WHERE meal_plan_id IS NOT NULL;
CREATE INDEX kookmomenten_user_idx ON public.kookmomenten (user_id, gekookt_op DESC);

ALTER TABLE public.kookmomenten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kookmomenten FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kookmomenten TO authenticated;
GRANT ALL ON public.kookmomenten TO service_role;

CREATE POLICY kookmomenten_lezen ON public.kookmomenten
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY kookmomenten_maken ON public.kookmomenten
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (meal_plan_id IS NULL OR EXISTS (SELECT 1 FROM public.meal_plan p WHERE p.id = meal_plan_id))
    AND (recipe_id IS NULL OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id))
  );
CREATE POLICY kookmomenten_wijzigen ON public.kookmomenten
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND (meal_plan_id IS NULL OR EXISTS (SELECT 1 FROM public.meal_plan p WHERE p.id = meal_plan_id))
    AND (recipe_id IS NULL OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id))
  );
CREATE POLICY kookmomenten_wissen ON public.kookmomenten
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
