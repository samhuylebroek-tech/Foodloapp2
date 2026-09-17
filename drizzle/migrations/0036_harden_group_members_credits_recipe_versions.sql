-- 1. group_members: geen enkele client mag zelf lidmaatschappen aanmaken.
--    Uitnodigen/joinen loopt uitsluitend via SECURITY DEFINER functies.
CREATE POLICY "group_members_no_client_insert" ON public.group_members
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);

-- 2. user_credits: saldo's zijn server-side; blokkeer alle client-writes.
CREATE POLICY "user_credits_no_insert" ON public.user_credits
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "user_credits_no_update" ON public.user_credits
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "user_credits_no_delete" ON public.user_credits
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 3. recipe_versions: leesrechten gelijk aan het deelmodel van recipes,
--    schrijven blijft voorbehouden aan de eigenaar.
DROP POLICY IF EXISTS "recipe_versions_eigenaar" ON public.recipe_versions;

CREATE POLICY "recipe_versions_select_gedeeld" ON public.recipe_versions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_versions.recipe_id
      AND public.has_share(r.user_id, auth.uid(), 'recipes_view')
  ));

CREATE POLICY "recipe_versions_insert_eigenaar" ON public.recipe_versions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_versions.recipe_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "recipe_versions_update_eigenaar" ON public.recipe_versions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_versions.recipe_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_versions.recipe_id AND r.user_id = auth.uid()
  ));

CREATE POLICY "recipe_versions_delete_eigenaar" ON public.recipe_versions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipes r
    WHERE r.id = recipe_versions.recipe_id AND r.user_id = auth.uid()
  ));
