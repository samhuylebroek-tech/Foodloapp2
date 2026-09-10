CREATE TABLE public.recipe_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  stars smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recipe_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ratings TO authenticated;
GRANT ALL ON public.recipe_ratings TO service_role;

ALTER TABLE public.recipe_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_ratings_own ON public.recipe_ratings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND stars >= 0 AND stars <= 5);

CREATE TRIGGER recipe_ratings_updated_at
  BEFORE UPDATE ON public.recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.decline_share(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE s public.shares%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  SELECT * INTO s FROM public.shares WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'uitnodiging niet gevonden'; END IF;
  IF s.status = 'accepted' THEN RAISE EXCEPTION 'uitnodiging al aangenomen'; END IF;
  UPDATE public.shares SET status = 'declined' WHERE id = s.id;
  RETURN true;
END; $$;