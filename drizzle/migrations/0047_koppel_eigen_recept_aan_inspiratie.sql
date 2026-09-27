ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS inspiration_id uuid REFERENCES public.inspiration_recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recipes_user_inspiration_idx
ON public.recipes (user_id, inspiration_id)
WHERE deleted_at IS NULL AND inspiration_id IS NOT NULL;

COMMENT ON COLUMN public.recipes.inspiration_id IS 'Het inspiratiegerecht waaruit dit eigen recept werd toegevoegd; gebruikt om het niet opnieuw als idee te tonen.';