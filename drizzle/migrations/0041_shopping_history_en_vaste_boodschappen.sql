CREATE TABLE public.shopping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid,
  group_id uuid,
  name text NOT NULL,
  quantity numeric,
  unit text NOT NULL DEFAULT '',
  recipe_id uuid,
  gekocht_op timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.shopping_history TO authenticated;
GRANT ALL ON public.shopping_history TO service_role;
ALTER TABLE public.shopping_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen of gezin lezen" ON public.shopping_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id)));
CREATE POLICY "eigen toevoegen" ON public.shopping_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (group_id IS NULL OR public.in_groep(auth.uid(), group_id)));
CREATE POLICY "eigen verwijderen" ON public.shopping_history FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX shopping_history_user_idx ON public.shopping_history (user_id, gekocht_op DESC);

CREATE TABLE public.shopping_staples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  quantity numeric,
  unit text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_staples TO authenticated;
GRANT ALL ON public.shopping_staples TO service_role;
ALTER TABLE public.shopping_staples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen vaste boodschappen" ON public.shopping_staples FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());