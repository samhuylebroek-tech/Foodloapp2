CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  naam text NOT NULL,
  hoeveelheid numeric,
  eenheid text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pantry_items_user_idx ON public.pantry_items (user_id, naam);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_items TO authenticated;
GRANT ALL ON public.pantry_items TO service_role;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_items_eigen ON public.pantry_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY pantry_items_gedeeld_lezen ON public.pantry_items
  FOR SELECT TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_view') OR public.samen_in_groep(user_id, auth.uid()));

CREATE TABLE public.recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  momentopname jsonb NOT NULL,
  gewijzigd_door uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_versions_recipe_idx ON public.recipe_versions (recipe_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.recipe_versions TO authenticated;
GRANT ALL ON public.recipe_versions TO service_role;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_versions_eigenaar ON public.recipe_versions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));