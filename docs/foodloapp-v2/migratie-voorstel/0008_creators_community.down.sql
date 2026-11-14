-- Terugdraaien van 0008. Makerprofielen, publicaties, volgers, verzamelingen, bijdragen en
-- meldingen gaan verloren (dat is de bedoeling van terugdraaien); recepten zelf blijven staan.
BEGIN;
DROP POLICY IF EXISTS recipes_select_openbaar ON public.recipes;
DROP POLICY IF EXISTS ingredients_select_openbaar ON public.recipe_ingredients;
DROP TABLE IF EXISTS public.content_meldingen;
DROP TABLE IF EXISTS public.community_bijdragen;
DROP TABLE IF EXISTS public.collection_recipes;
DROP TABLE IF EXISTS public.collections;
DROP TABLE IF EXISTS public.follows;
DROP TABLE IF EXISTS public.recipe_publicaties;
DROP TABLE IF EXISTS public.creators;
DROP FUNCTION IF EXISTS public.maker_statistiek(uuid);
DROP FUNCTION IF EXISTS public.bewaak_creator();
DROP FUNCTION IF EXISTS public.bewaak_publicatie();
DROP FUNCTION IF EXISTS public.is_openbaar_recept(uuid);
COMMIT;
