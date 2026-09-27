ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_concept boolean NOT NULL DEFAULT false;
ALTER TABLE public.meal_plan ADD COLUMN IF NOT EXISTS soort text;
CREATE OR REPLACE FUNCTION public.check_recipe_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _actief boolean; _max integer; _aantal integer;
BEGIN
  SELECT COALESCE((value #>> '{}')::boolean, false) INTO _actief FROM public.platform_settings WHERE key = 'testfase_actief';
  IF COALESCE(_actief, false) = false THEN RETURN NEW; END IF;
  IF public.is_admin(NEW.user_id) THEN RETURN NEW; END IF;
  SELECT COALESCE((value #>> '{}')::integer, 20) INTO _max FROM public.platform_settings WHERE key = 'max_gerechten';
  _max := COALESCE(_max, 20);
  SELECT count(*) INTO _aantal FROM public.recipes WHERE user_id = NEW.user_id AND deleted_at IS NULL AND is_concept = false;
  IF _aantal >= _max THEN
    RAISE EXCEPTION 'RECEPT_LIMIET: Tijdens de testperiode kan je maximaal % gerechten bewaren. Verwijder er eentje om plaats te maken.', _max;
  END IF;
  RETURN NEW;
END; $function$;