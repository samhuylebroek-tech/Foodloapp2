-- VOORSTEL — NIET UITGEVOERD. P4 Proactieve suggesties: instellingen op het account.
--
-- suggestie_instellingen (één rij per gebruiker):
-- - uit: soorten suggesties die uit staan (vaste codes; standaard staat alles aan);
-- - verborgen: kaarten die je niet meer wilt zien ("Niet meer tonen"), max. 100 korte sleutels;
-- - alleen de eigen rij is leesbaar en schrijfbaar (geen gezin, geen vrienden); geen
--   gezondheidsgegevens;
-- - de app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en bewaart
--   anders op het toestel, zoals vóór dit voorstel.
--
-- Lokaal getest met tests/rls/suggesties.mjs (PGlite). Terugdraaien: 0016_…down.sql.

BEGIN;

CREATE TABLE public.suggestie_instellingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  uit text[] NOT NULL DEFAULT '{}' CHECK (
    uit <@ ARRAY['restjes','over-datum','budget','weer','variatie','seizoen','boodschappen']::text[]
  ),
  verborgen text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(verborgen) <= 100 AND char_length(array_to_string(verborgen, '')) <= 12000
  ),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestie_instellingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suggestie_instellingen FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestie_instellingen TO authenticated;

CREATE POLICY suggestie_instellingen_lezen ON public.suggestie_instellingen
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY suggestie_instellingen_maken ON public.suggestie_instellingen
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY suggestie_instellingen_wijzigen ON public.suggestie_instellingen
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY suggestie_instellingen_wissen ON public.suggestie_instellingen
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
