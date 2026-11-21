-- VOORSTEL — NIET UITGEVOERD. Persoonlijke voeding op het account (MODULE_DESIGNS §1,
-- DATABASE_ARCHITECTURE §4; vroeger "0004b" genoemd, hernummerd naar 0009 omdat 0005 gereserveerd is).
-- Bijzondere gegevens (AVG art. 9): allergieën, intoleranties, dieet, "liever niet".
-- Regels:
-- - één rij per gebruiker, alleen de eigen rij is leesbaar en schrijfbaar (ook niet voor gezin,
--   vrienden of beheer via de app; service-rol enkel voor export en verwijderen);
-- - alleen vaste codes; "liever niet" max. 20 korte termen van max. 40 tekens;
-- - toestemming_op is verplicht (uitdrukkelijke toestemming, art. 9.2.a); intrekken = rij wissen;
-- - nooit gelezen door AI-functies (app: voorAI(); hier: geen definer-functie die dit leest).
-- De app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en houdt de
-- gegevens anders op het toestel, zoals vóór dit voorstel.
-- Lokaal getest met tests/rls/huishouden-voeding.mjs (PGlite). Terugdraaien: 0009_…down.sql.

BEGIN;

CREATE TABLE public.persoonlijke_voeding (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  allergieen text[] NOT NULL DEFAULT '{}' CHECK (
    allergieen <@ ARRAY['gluten','schaaldieren','eieren','vis','pindas','soja','melk','noten',
      'selder','mosterd','sesam','sulfiet','lupine','weekdieren']::text[]
  ),
  intoleranties text[] NOT NULL DEFAULT '{}' CHECK (
    intoleranties <@ ARRAY['lactose','gluten','fructose','histamine']::text[]
  ),
  dieet text CHECK (dieet IS NULL OR dieet IN ('alles','weinig-vlees','pescotarisch','vegetarisch','veganistisch')),
  uitsluitingen text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(uitsluitingen) <= 20 AND char_length(array_to_string(uitsluitingen, '')) <= 800
  ),
  toestemming_op timestamptz NOT NULL,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.persoonlijke_voeding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.persoonlijke_voeding FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persoonlijke_voeding TO authenticated;

CREATE POLICY persoonlijke_voeding_lezen ON public.persoonlijke_voeding
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY persoonlijke_voeding_maken ON public.persoonlijke_voeding
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY persoonlijke_voeding_wijzigen ON public.persoonlijke_voeding
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY persoonlijke_voeding_wissen ON public.persoonlijke_voeding
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
