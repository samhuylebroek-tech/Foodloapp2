-- Terugdraaien van 0007. De ingevulde datums gaan verloren; de producten zelf blijven.
DROP INDEX IF EXISTS public.pantry_items_houdbaar_idx;
ALTER TABLE public.pantry_items DROP COLUMN IF EXISTS houdbaar_tot;
