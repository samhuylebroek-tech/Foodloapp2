CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Boodschappen',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopping_lists_select ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_view'));

CREATE POLICY shopping_lists_write ON public.shopping_lists
  FOR ALL TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_edit'))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'shopping_edit'));

CREATE TRIGGER shopping_lists_updated_at BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shopping_items
  ADD COLUMN list_id uuid REFERENCES public.shopping_lists(id) ON DELETE CASCADE;

CREATE INDEX shopping_items_list_id_idx ON public.shopping_items(list_id);

INSERT INTO public.shopping_lists (user_id, name)
SELECT DISTINCT user_id, 'Boodschappen' FROM public.shopping_items;

UPDATE public.shopping_items i
SET list_id = l.id
FROM public.shopping_lists l
WHERE l.user_id = i.user_id AND i.list_id IS NULL;

ALTER TABLE public.meal_plan ALTER COLUMN recipe_id DROP NOT NULL;
ALTER TABLE public.meal_plan ADD COLUMN custom_title text;