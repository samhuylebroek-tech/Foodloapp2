-- Terugdraaien van 0021. Testabonnementen, testbetalingen, plannen en blokkades gaan verloren
-- (dat is de bedoeling van terugdraaien). Reacties zonder sterren passen niet meer in het schema
-- van 0008 en worden verwijderd; "Ik heb het gemaakt"-bijdragen en hun foto's (bestanden in de
-- bucket blijven staan tot een opruimtaak ze wist) blijven. Alles weer zoals na 0008.
BEGIN;

-- meldingen in de app (0017)
DO $$
BEGIN
  IF to_regclass('public.app_melding_instellingen') IS NOT NULL THEN
    UPDATE public.app_melding_instellingen SET uit = array_remove(uit, 'maker');
    ALTER TABLE public.app_melding_instellingen DROP CONSTRAINT IF EXISTS app_melding_instellingen_uit_check;
    ALTER TABLE public.app_melding_instellingen ADD CONSTRAINT app_melding_instellingen_uit_check CHECK (
      uit <@ ARRAY['menu','toegewezen','winkelen-klaar','restje','conflict']::text[]
    );
  END IF;
END $$;

-- opslag
DROP POLICY IF EXISTS community_fotos_lezen ON storage.objects;
DROP POLICY IF EXISTS community_fotos_wissen ON storage.objects;
DROP POLICY IF EXISTS community_fotos_schrijven ON storage.objects;
-- De bucket zelf blijft (bestanden erin worden niet stil gewist):
-- DELETE FROM storage.buckets WHERE id = 'community-fotos';

-- policies terug naar 0008
DROP POLICY IF EXISTS bijdragen_lezen ON public.community_bijdragen;
CREATE POLICY bijdragen_lezen ON public.community_bijdragen FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (NOT verborgen AND public.is_openbaar_recept(recipe_id)));
DROP POLICY IF EXISTS collection_recipes_lezen ON public.collection_recipes;
CREATE POLICY collection_recipes_lezen ON public.collection_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                 AND (c.user_id = auth.uid() OR c.openbaar)));
DROP POLICY IF EXISTS collections_lezen ON public.collections;
CREATE POLICY collections_lezen ON public.collections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR openbaar);

-- meldingen van inhoud
DROP TRIGGER IF EXISTS content_meldingen_verberg ON public.content_meldingen;
DROP FUNCTION IF EXISTS public.verberg_na_meldingen();
DROP INDEX IF EXISTS public.content_meldingen_een_open;

-- is_openbaar_recept zoals in 0008 (zonder exclusiviteit)
CREATE OR REPLACE FUNCTION public.is_openbaar_recept(_recipe uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipe_publicaties p JOIN public.recipes r ON r.id = p.recipe_id
     WHERE p.recipe_id = _recipe AND p.zichtbaarheid = 'openbaar' AND p.status = 'gepubliceerd'
       AND p.moderatie = 'goedgekeurd' AND r.deleted_at IS NULL
  );
$$;
DROP FUNCTION IF EXISTS public.maker_abonnees(uuid);
DROP FUNCTION IF EXISTS public.exclusieve_aankondigingen(uuid);
DROP FUNCTION IF EXISTS public.heeft_maker_recht_van(uuid);
DROP FUNCTION IF EXISTS public.heeft_maker_recht(uuid);

-- community: terug naar sterren verplicht, zonder soort
DELETE FROM public.community_bijdragen WHERE soort = 'reactie';
ALTER TABLE public.community_bijdragen DROP CONSTRAINT IF EXISTS community_bijdragen_foto_eigen;
ALTER TABLE public.community_bijdragen DROP CONSTRAINT IF EXISTS community_bijdragen_sterren_soort;
ALTER TABLE public.community_bijdragen ALTER COLUMN sterren SET NOT NULL;
ALTER TABLE public.community_bijdragen ADD CONSTRAINT community_bijdragen_sterren_check
  CHECK (sterren BETWEEN 1 AND 5);
ALTER TABLE public.community_bijdragen DROP COLUMN IF EXISTS soort;

DROP TABLE IF EXISTS public.gebruiker_blokkades;
DROP TABLE IF EXISTS public.maker_betalingen;
DROP TABLE IF EXISTS public.maker_abonnementen;
DROP TABLE IF EXISTS public.maker_plannen;
ALTER TABLE public.collections DROP COLUMN IF EXISTS exclusief;
ALTER TABLE public.recipe_publicaties DROP COLUMN IF EXISTS exclusief;

COMMIT;
