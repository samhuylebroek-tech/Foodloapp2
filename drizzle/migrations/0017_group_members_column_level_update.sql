-- Een gezinslid mag enkel nog de eigen deelschakelaars aanpassen,
-- nooit de rol of het lidmaatschap zelf.
REVOKE UPDATE ON public.group_members FROM authenticated;
GRANT UPDATE (recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit)
  ON public.group_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

-- Rolwijzigingen blijven ook op databaseniveau geblokkeerd voor niet-eigenaars.
DROP POLICY IF EXISTS group_members_update ON public.group_members;
CREATE POLICY group_members_update ON public.group_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());