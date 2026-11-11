-- VOORSTEL — NIET UITGEVOERD. BUG-119: weekmenuvoorkeuren (profiles.weekmenu, met het vrije veld
-- "vermijd", mogelijk allergieën = gezondheidsgegevens, AVG art. 9) zijn leesbaar voor elk actief
-- gezinslid en voor wie een openstaande deeluitnodiging met je heeft. Kolomrechten gelden voor
-- alle rijen; daarom: kolom niet meer rechtstreeks leesbaar, de eigen waarde via een functie.
-- Lokaal getest met tests/rls/rls-gezin-privacy.mjs --met (PGlite).
-- Volgorde bij uitrol: EERST de app die eigen_weekmenu() gebruikt (met terugval), DAN deze migratie.

BEGIN;

CREATE OR REPLACE FUNCTION public.eigen_weekmenu()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT weekmenu FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.eigen_weekmenu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eigen_weekmenu() TO authenticated;

-- Schrijven blijft zoals nu (eigen rij via profiles_update_own); alleen lezen verdwijnt.
REVOKE SELECT (weekmenu) ON public.profiles FROM authenticated;

COMMIT;
