-- VOORSTEL — NIET UITGEVOERD. Foodloapp Intelligence, Feedback Engine (FOODLOAPP-INTELLIGENCE-
-- ARCHITECTUUR §2.6, beslissing 17). Jouw reactie op een voorstel: "Niet nu", "Niet voor mij" of
-- "Gekozen". Alleen jij ziet je eigen rijen; gezinsleden en uitnodigers niet.
-- Bewust GEEN vrij tekstveld: `onderwerp` is een korte code (bv. 'curry'), `reden` een redencode
-- (bv. 'warm_weer'). Zo kan hier nooit een allergie of gezondheidsinfo in vrije tekst belanden.
-- Bewaren: "Niet nu" en "Gekozen" 12 maanden; "Niet voor mij" blijft tot je het zelf terugzet.
-- Lokaal getest met tests/rls/intelligentie-voorstellen.mjs (PGlite).

BEGIN;

CREATE TABLE public.aanbeveling_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  recept_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  onderwerp text CHECK (onderwerp ~ '^[a-z0-9_]{1,40}$'),
  signaal text NOT NULL CHECK (signaal IN ('niet_nu', 'niet_voor_mij', 'gekozen')),
  reden text CHECK (reden ~ '^[a-z0-9_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (recept_id IS NOT NULL OR onderwerp IS NOT NULL)
);
CREATE INDEX aanbeveling_feedback_user_idx ON public.aanbeveling_feedback (user_id, created_at DESC);

-- Geen UPDATE: een reactie wijzigen = verwijderen (terugzetten) en opnieuw geven.
-- Supabase geeft nieuwe tabellen standaard alle rechten aan anon en authenticated: eerst intrekken.
REVOKE ALL ON public.aanbeveling_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.aanbeveling_feedback TO authenticated;
GRANT ALL ON public.aanbeveling_feedback TO service_role;
ALTER TABLE public.aanbeveling_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY aanbeveling_feedback_eigen ON public.aanbeveling_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ruim_aanbeveling_feedback_op()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM public.aanbeveling_feedback
   WHERE signaal IN ('niet_nu', 'gekozen') AND created_at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.ruim_aanbeveling_feedback_op() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruim_aanbeveling_feedback_op() TO service_role;

COMMIT;

SELECT cron.schedule('foodlo-aanbeveling-feedback', '50 3 * * 1', $$SELECT public.ruim_aanbeveling_feedback_op()$$);
