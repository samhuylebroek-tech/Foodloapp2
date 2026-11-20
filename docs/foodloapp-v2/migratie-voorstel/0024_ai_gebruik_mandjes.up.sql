-- VOORSTEL — NIET UITGEVOERD. Fase 7: AI-gebruik per dag (geaggregeerd) en winkelmandjes in
-- testmodus.
--
-- ai_gebruik_dag: per gebruiker, per dag en per soort het AANTAL slimme acties (en hoeveel uit de
--   cache kwamen). Nooit de vraag, het antwoord, een recept of gezondheidsgegevens.
--   - lezen: alleen je eigen rijen; schrijven: alleen via public.ai_gebruik_tel() (+1, vaste
--     soorten, hooguit 500 per dag per soort zodat niemand de tellers kan opblazen).
-- ai_gebruik_totaal: per dag en soort het totaal over iedereen samen (geen user_id). Alleen de
--   server (service_role) leest dit voor het Control Center; de app nooit.
-- Cache: de servercache voor identieke AI-vragen BESTAAT al (public.ai_cache, gebruikt door
--   metCredits in credits.server.ts); dit voorstel raakt die niet. Op het toestel komt daar een
--   cache van 24 u bij (src/lib/ai/vraag-cache.ts), zonder databank.
-- winkel_mandjes: een mandje dat in TESTMODUS naar de testwinkel ging (provider 'test', test =
--   true verplicht). Eigen rijen lezen, maken en wissen; niet wijzigen. Een lijst koppelen kan
--   alleen als je die lijst mag zien (RLS van shopping_lists in de subquery). Een echte winkel
--   vraagt een nieuw voorstel (provider, geen testmodus, partnercontract).
-- Bewaartermijn: public.ruim_ai_op() (alleen service_role, geplande taak): gebruik ouder dan 400 dagen weg, testmandjes ouder dan 90 dagen weg.
-- Account weg = eigen gebruik en mandjes weg (ON DELETE CASCADE). Totalen blijven
--   (bevatten niemand).
--
-- De app controleert eerst of de tabellen bestaan (src/lib/module-beschikbaar.ts) en houdt het
-- gebruik anders op het toestel bij. Lokaal getest met tests/rls/ai-gebruik-mandjes.mjs (PGlite).
-- Terugdraaien: 0024_ai_gebruik_mandjes.down.sql.

BEGIN;

CREATE TABLE public.ai_gebruik_dag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dag date NOT NULL,
  soort text NOT NULL CHECK (soort IN ('kookhulp.vervang', 'kookhulp.vraag', 'weekassistent')),
  aantal integer NOT NULL DEFAULT 0 CHECK (aantal BETWEEN 0 AND 500),
  uit_cache integer NOT NULL DEFAULT 0 CHECK (uit_cache BETWEEN 0 AND 500),
  UNIQUE (user_id, dag, soort)
);

CREATE TABLE public.ai_gebruik_totaal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dag date NOT NULL,
  soort text NOT NULL CHECK (soort IN ('kookhulp.vervang', 'kookhulp.vraag', 'weekassistent')),
  aantal bigint NOT NULL DEFAULT 0 CHECK (aantal >= 0),
  uit_cache bigint NOT NULL DEFAULT 0 CHECK (uit_cache >= 0),
  UNIQUE (dag, soort)
);

CREATE TABLE public.winkel_mandjes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES public.shopping_lists(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider = 'test'),
  test boolean NOT NULL DEFAULT true CHECK (test),
  referentie text NOT NULL CHECK (referentie ~ '^TEST-[0-9]{6}$'),
  regels jsonb NOT NULL CHECK (jsonb_typeof(regels) = 'array' AND jsonb_array_length(regels) BETWEEN 1 AND 200),
  totaal_cent integer NOT NULL CHECK (totaal_cent BETWEEN 0 AND 10000000),
  zonder_prijs integer NOT NULL DEFAULT 0 CHECK (zonder_prijs >= 0),
  niet_gevonden jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(niet_gevonden) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX winkel_mandjes_user_idx ON public.winkel_mandjes (user_id, created_at DESC);

-- +1 voor de aangemelde gebruiker (en het anonieme totaal). Vaste soorten, begrensd per dag.
CREATE OR REPLACE FUNCTION public.ai_gebruik_tel(p_soort text, p_cache boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wie uuid := auth.uid();
  vandaag date := (now() AT TIME ZONE 'Europe/Brussels')::date;
BEGIN
  IF wie IS NULL THEN
    RAISE EXCEPTION 'niet aangemeld' USING ERRCODE = '42501';
  END IF;
  IF p_soort NOT IN ('kookhulp.vervang', 'kookhulp.vraag', 'weekassistent') THEN
    RAISE EXCEPTION 'onbekende soort' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ai_gebruik_dag AS d (user_id, dag, soort, aantal, uit_cache)
  VALUES (wie, vandaag, p_soort, CASE WHEN p_cache THEN 0 ELSE 1 END, CASE WHEN p_cache THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, dag, soort) DO UPDATE
    SET aantal = LEAST(500, d.aantal + CASE WHEN p_cache THEN 0 ELSE 1 END),
        uit_cache = LEAST(500, d.uit_cache + CASE WHEN p_cache THEN 1 ELSE 0 END)
    WHERE (CASE WHEN p_cache THEN d.uit_cache ELSE d.aantal END) < 500;
  IF NOT FOUND THEN
    RETURN; -- dagplafond bereikt: het totaal telt ook niet verder
  END IF;
  INSERT INTO public.ai_gebruik_totaal AS t (dag, soort, aantal, uit_cache)
  VALUES (vandaag, p_soort, CASE WHEN p_cache THEN 0 ELSE 1 END, CASE WHEN p_cache THEN 1 ELSE 0 END)
  ON CONFLICT (dag, soort) DO UPDATE
    SET aantal = t.aantal + CASE WHEN p_cache THEN 0 ELSE 1 END,
        uit_cache = t.uit_cache + CASE WHEN p_cache THEN 1 ELSE 0 END;
END $$;
REVOKE ALL ON FUNCTION public.ai_gebruik_tel(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_gebruik_tel(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.ruim_ai_op()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.ai_gebruik_dag WHERE dag < (now() - interval '400 days')::date;
  DELETE FROM public.winkel_mandjes WHERE created_at < now() - interval '90 days';
$$;
REVOKE ALL ON FUNCTION public.ruim_ai_op() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruim_ai_op() TO service_role;

ALTER TABLE public.ai_gebruik_dag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_gebruik_totaal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winkel_mandjes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_gebruik_dag, public.ai_gebruik_totaal, public.winkel_mandjes
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_gebruik_dag TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.winkel_mandjes TO authenticated;
GRANT ALL ON public.ai_gebruik_dag, public.ai_gebruik_totaal, public.winkel_mandjes
  TO service_role;

CREATE POLICY ai_gebruik_dag_eigen ON public.ai_gebruik_dag
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY winkel_mandjes_lezen ON public.winkel_mandjes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY winkel_mandjes_maken ON public.winkel_mandjes
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (list_id IS NULL OR EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = list_id))
  );
CREATE POLICY winkel_mandjes_wissen ON public.winkel_mandjes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
