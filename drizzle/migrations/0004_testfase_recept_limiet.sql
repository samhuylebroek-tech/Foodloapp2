-- Testfase: per gebruiker een maximum aantal gerechten, server-side afgedwongen.
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('testfase_actief', 'true'::jsonb, 'Testfase: beperkt aantal gerechten per gebruiker'),
  ('max_gerechten', '20'::jsonb, 'Maximum aantal gerechten per gebruiker tijdens de testfase')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_recipe_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _actief boolean; _max integer; _aantal integer;
BEGIN
  SELECT COALESCE((value #>> '{}')::boolean, false) INTO _actief
    FROM public.platform_settings WHERE key = 'testfase_actief';
  IF COALESCE(_actief, false) = false THEN RETURN NEW; END IF;

  IF public.is_admin(NEW.user_id) THEN RETURN NEW; END IF;

  SELECT COALESCE((value #>> '{}')::integer, 20) INTO _max
    FROM public.platform_settings WHERE key = 'max_gerechten';
  _max := COALESCE(_max, 20);

  SELECT count(*) INTO _aantal FROM public.recipes
   WHERE user_id = NEW.user_id AND deleted_at IS NULL;

  IF _aantal >= _max THEN
    RAISE EXCEPTION 'RECEPT_LIMIET: Tijdens de testperiode kan je maximaal % gerechten bewaren. Verwijder er eentje om plaats te maken.', _max;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.check_recipe_limit() FROM anon, authenticated;

DROP TRIGGER IF EXISTS recipes_limit ON public.recipes;
CREATE TRIGGER recipes_limit
BEFORE INSERT ON public.recipes
FOR EACH ROW EXECUTE FUNCTION public.check_recipe_limit();