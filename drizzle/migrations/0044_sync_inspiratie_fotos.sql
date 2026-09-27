UPDATE public.inspiration_recipes i
SET image_url = r.image_url
FROM public.recipes r
WHERE r.id = i.bron_recipe_id
  AND r.image_url IS NOT NULL
  AND r.image_url NOT LIKE 'http%'
  AND coalesce(i.image_url, '') <> r.image_url;

CREATE OR REPLACE FUNCTION public.sync_inspiratie_foto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.image_url IS NOT NULL AND NEW.image_url NOT LIKE 'http%'
     AND NEW.image_url IS DISTINCT FROM OLD.image_url THEN
    UPDATE public.inspiration_recipes SET image_url = NEW.image_url WHERE bron_recipe_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_inspiratie_foto() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_inspiratie_foto ON public.recipes;
CREATE TRIGGER trg_sync_inspiratie_foto
AFTER UPDATE OF image_url ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.sync_inspiratie_foto();