-- BASISLIJN VOOR NIEUWE OMGEVINGEN (lokaal, staging) — NIET OP PRODUCTIE UITVOEREN.
-- Productie (Lovable Cloud) heeft deze regels al, gecontroleerd door de eigenaar op 2026-11-11:
--   recipes_select = (deleted_at IS NULL) AND has_share(user_id, auth.uid(), 'recipes_view');
--   storage recipe_photos_read = eigen map OF gedeeld recept via has_share; bucket Private.
-- De migratiebestanden in de repo missen dit (schema-drift, BUG-011). Deze basislijn brengt een
-- omgeving die uit de repo wordt opgebouwd op hetzelfde veiligheidsniveau. Vóór gebruik op staging:
-- de exacte live tekst van recipe_photos_read overnemen (Policies-scherm), zodat repo = productie.

BEGIN;

-- 1. BUG-105: recepten alleen voor eigenaar, vrienden met recipes_view en actieve gezinsleden
--    met recipes_view (has_share omvat groep_recht). Verwijderde recepten blijven verborgen.
DROP POLICY IF EXISTS recipes_select ON public.recipes;
CREATE POLICY recipes_select ON public.recipes AS PERMISSIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_share(user_id, (SELECT auth.uid()), 'recipes_view'));

-- Fotorijen: expliciet dezelfde zichtbaarheid als het recept (de subquery valt ook onder RLS).
DROP POLICY IF EXISTS "Zichtbare receptfotos lezen" ON public.recipe_photos;
CREATE POLICY "Zichtbare receptfotos lezen" ON public.recipe_photos AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_photos.recipe_id
    AND r.deleted_at IS NULL AND public.has_share(r.user_id, (SELECT auth.uid()), 'recipes_view')));

-- 2. BUG-106: opslag. De brede leesregel (hele bucket) weg. Lezen mag: eigen map, of het object
--    hoort bij een recept/fotorij die je mag zien (subqueries onder RLS), of bij Inspiratie
--    (bestaande policy recipe_photos_read_inspiratie blijft ongewijzigd).
DROP POLICY IF EXISTS recipe_photos_read ON storage.objects;
CREATE POLICY recipe_photos_read_zichtbaar ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-photos' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.image_url = objects.name)
    OR EXISTS (SELECT 1 FROM public.recipe_photos p WHERE p.path = objects.name)));
CREATE INDEX IF NOT EXISTS recipes_image_url_idx ON public.recipes (image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS recipe_photos_path_idx ON public.recipe_photos (path);


COMMIT;
