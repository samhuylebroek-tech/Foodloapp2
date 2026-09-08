CREATE TABLE public.shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'open',
  recipes_view boolean NOT NULL DEFAULT true,
  recipes_edit boolean NOT NULL DEFAULT false,
  planner_view boolean NOT NULL DEFAULT false,
  planner_edit boolean NOT NULL DEFAULT false,
  shopping_view boolean NOT NULL DEFAULT false,
  shopping_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shares TO authenticated;
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY shares_owner_all ON public.shares FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY shares_member_select ON public.shares FOR SELECT TO authenticated
  USING (auth.uid() = member_id);
CREATE POLICY shares_member_delete ON public.shares FOR DELETE TO authenticated
  USING (auth.uid() = member_id);

CREATE UNIQUE INDEX shares_owner_member_uniq ON public.shares (owner_id, member_id) WHERE member_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.has_share(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = _viewer OR EXISTS (
    SELECT 1 FROM public.shares s
    WHERE s.owner_id = _owner AND s.member_id = _viewer AND s.status = 'accepted'
      AND CASE _perm
        WHEN 'recipes_view'  THEN s.recipes_view OR s.recipes_edit
        WHEN 'recipes_edit'  THEN s.recipes_edit
        WHEN 'planner_view'  THEN s.planner_view OR s.planner_edit
        WHEN 'planner_edit'  THEN s.planner_edit
        WHEN 'shopping_view' THEN s.shopping_view OR s.shopping_edit
        WHEN 'shopping_edit' THEN s.shopping_edit
        ELSE false END
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_share(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_share(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_share(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shares%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  SELECT * INTO s FROM public.shares WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'uitnodiging niet gevonden'; END IF;
  IF s.owner_id = auth.uid() THEN RAISE EXCEPTION 'eigen uitnodiging'; END IF;
  IF s.member_id IS NOT NULL AND s.member_id <> auth.uid() THEN RAISE EXCEPTION 'uitnodiging al gebruikt'; END IF;
  UPDATE public.shares SET member_id = auth.uid(), status = 'accepted', accepted_at = now()
    WHERE id = s.id;
  RETURN s.owner_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_share(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_share(text) TO authenticated;

DROP POLICY recipes_select ON public.recipes;
CREATE POLICY recipes_select ON public.recipes FOR SELECT TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'recipes_view'));
DROP POLICY recipes_update_own ON public.recipes;
CREATE POLICY recipes_update ON public.recipes FOR UPDATE TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'recipes_edit'))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'recipes_edit'));

DROP POLICY ingredients_select ON public.recipe_ingredients;
CREATE POLICY ingredients_select ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_share(r.user_id, auth.uid(), 'recipes_view')));
DROP POLICY ingredients_write ON public.recipe_ingredients;
CREATE POLICY ingredients_write ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_share(r.user_id, auth.uid(), 'recipes_edit')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id
    AND public.has_share(r.user_id, auth.uid(), 'recipes_edit')));

DROP POLICY meal_plan_own ON public.meal_plan;
CREATE POLICY meal_plan_select ON public.meal_plan FOR SELECT TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'planner_view'));
CREATE POLICY meal_plan_write ON public.meal_plan FOR ALL TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'planner_edit'))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'planner_edit'));

DROP POLICY shopping_items_own ON public.shopping_items;
CREATE POLICY shopping_items_select ON public.shopping_items FOR SELECT TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_view'));
CREATE POLICY shopping_items_write ON public.shopping_items FOR ALL TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_edit'))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'shopping_edit'));