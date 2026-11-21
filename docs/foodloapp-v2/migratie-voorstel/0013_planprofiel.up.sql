-- VOORSTEL — NIET UITGEVOERD. P1 Slimme planner: planprofiel op het account en
-- apparatuurvereisten per recept.
--
-- planprofiel (één rij per gebruiker):
-- - keukenapparatuur (vaste codes), kookervaring, voorraadniveau, basisvoorraad (max. 40 korte
--   productnamen) en weekbudget (euro, 1–5000);
-- - alleen de eigen rij is leesbaar en schrijfbaar (geen gezin, geen vrienden): een budget is
--   persoonlijk; geen gezondheidsgegevens;
-- - de app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en bewaart
--   anders op het toestel, zoals vóór dit voorstel.
--
-- recept_vereisten (één rij per recept, alleen als de eigenaar iets aanpaste in de editor):
-- - apparatuur die het recept vraagt (vaste codes); zonder rij leidt de app het af uit de tekst;
-- - lezen: wie het recept mag lezen (de policies van recipes gelden in de subquery);
-- - schrijven: alleen de eigenaar van het recept.
--
-- Lokaal getest met tests/rls/planprofiel.mjs (PGlite). Terugdraaien: 0013_…down.sql.

BEGIN;

CREATE TABLE public.planprofiel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  apparatuur text[] CHECK (
    apparatuur IS NULL OR apparatuur <@ ARRAY['oven','kookplaat','airfryer','microgolf',
      'slowcooker','stoomoven','keukenrobot','blender','contactgrill','andere']::text[]
  ),
  kookervaring text CHECK (kookervaring IS NULL OR kookervaring IN ('beginner','gemiddeld','ervaren')),
  voorraadniveau text CHECK (voorraadniveau IS NULL OR voorraadniveau IN ('geen','basis','volledig')),
  basisvoorraad text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(basisvoorraad) <= 40 AND char_length(array_to_string(basisvoorraad, '')) <= 1600
  ),
  weekbudget numeric(7,2) CHECK (weekbudget IS NULL OR (weekbudget > 0 AND weekbudget <= 5000)),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planprofiel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planprofiel FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planprofiel TO authenticated;

CREATE POLICY planprofiel_lezen ON public.planprofiel
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY planprofiel_maken ON public.planprofiel
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY planprofiel_wijzigen ON public.planprofiel
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY planprofiel_wissen ON public.planprofiel
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.recept_vereisten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL UNIQUE REFERENCES public.recipes(id) ON DELETE CASCADE,
  apparatuur text[] NOT NULL DEFAULT '{}' CHECK (
    apparatuur <@ ARRAY['oven','kookplaat','airfryer','microgolf','slowcooker','stoomoven',
      'keukenrobot','blender','contactgrill','andere']::text[]
  ),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recept_vereisten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recept_vereisten FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recept_vereisten TO authenticated;

-- Lezen zoals het recept zelf (de RLS van recipes geldt binnen de subquery).
CREATE POLICY recept_vereisten_lezen ON public.recept_vereisten
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id));
CREATE POLICY recept_vereisten_maken ON public.recept_vereisten
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY recept_vereisten_wijzigen ON public.recept_vereisten
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY recept_vereisten_wissen ON public.recept_vereisten
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));

COMMIT;
