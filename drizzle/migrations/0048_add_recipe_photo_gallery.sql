CREATE TABLE public.recipe_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  path text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_photos TO authenticated;
GRANT ALL ON public.recipe_photos TO service_role;

ALTER TABLE public.recipe_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zichtbare receptfotos lezen"
ON public.recipe_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_photos.recipe_id
  )
);

CREATE POLICY "Eigen receptfotos toevoegen"
ON public.recipe_photos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_photos.recipe_id
      AND recipes.user_id = auth.uid()
  )
);

CREATE POLICY "Eigen receptfotos aanpassen"
ON public.recipe_photos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_photos.recipe_id
      AND recipes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_photos.recipe_id
      AND recipes.user_id = auth.uid()
  )
);

CREATE POLICY "Eigen receptfotos verwijderen"
ON public.recipe_photos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.recipes
    WHERE recipes.id = recipe_photos.recipe_id
      AND recipes.user_id = auth.uid()
  )
);

CREATE INDEX recipe_photos_recipe_position_idx
ON public.recipe_photos (recipe_id, position, created_at);