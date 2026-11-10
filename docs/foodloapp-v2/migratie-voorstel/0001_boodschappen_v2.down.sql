-- VOORSTEL — NIET UITGEVOERD. Draait 0001_boodschappen_v2.up.sql terug.
-- LET OP: dit wist alle merken, varianten, winkels, sjablonen en productfoto-verwijzingen die
-- gebruikers intussen invulden. Eerst exporteren (zie MIGRATIE-VOORSTEL-BOODSCHAPPEN.md §6).
-- De bestanden in de bucket 'product-fotos' moeten via de Storage-API gewist worden
-- (een DELETE op storage.objects laat de bestanden zelf staan).

BEGIN;

DROP POLICY IF EXISTS product_fotos_lezen ON storage.objects;
DROP POLICY IF EXISTS product_fotos_schrijven ON storage.objects;
DROP POLICY IF EXISTS product_fotos_wissen ON storage.objects;
-- De bucket zelf pas verwijderen nadat hij via de Storage-API is leeggemaakt:
-- DELETE FROM storage.buckets WHERE id = 'product-fotos';

DROP TABLE IF EXISTS public.product_voorkeuren;

ALTER TABLE public.shopping_history
  DROP COLUMN IF EXISTS store_id,
  DROP COLUMN IF EXISTS merk;

DROP INDEX IF EXISTS public.shopping_items_store_idx;
ALTER TABLE public.shopping_items
  DROP COLUMN IF EXISTS checked_at,
  DROP COLUMN IF EXISTS checked_by,
  DROP COLUMN IF EXISTS store_id,
  DROP COLUMN IF EXISTS photo_path,
  DROP COLUMN IF EXISTS variant,
  DROP COLUMN IF EXISTS merk;

DROP TABLE IF EXISTS public.shopping_template_items;
DROP TABLE IF EXISTS public.shopping_templates;
DROP TABLE IF EXISTS public.stores;

COMMIT;
