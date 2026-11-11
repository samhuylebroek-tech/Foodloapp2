-- Terugdraaien van de basislijn: herstelt de (te ruime) regels uit de repo-migraties.
-- Alleen voor lokale/staging-omgevingen; nooit op productie.

BEGIN;
DROP POLICY IF EXISTS recipes_select ON public.recipes;
DROP POLICY IF EXISTS "Zichtbare receptfotos lezen" ON public.recipe_photos;
DROP POLICY IF EXISTS recipe_photos_read_zichtbaar ON storage.objects;
DROP INDEX IF EXISTS public.recipes_image_url_idx;
DROP INDEX IF EXISTS public.recipe_photos_path_idx;
CREATE POLICY "recipe_photos_read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'recipe-photos'::text));
CREATE POLICY "Zichtbare receptfotos lezen" ON public.recipe_photos AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM recipes WHERE (recipes.id = recipe_photos.recipe_id))));
CREATE POLICY "recipes_select" ON public.recipes AS PERMISSIVE FOR SELECT TO authenticated
  USING ((deleted_at IS NULL));
COMMIT;
