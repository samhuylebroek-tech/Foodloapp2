CREATE OR REPLACE FUNCTION public.groep_lid_update_ok(
  _id uuid, _rol text, _status text,
  _rv boolean, _re boolean, _pv boolean, _pe boolean, _sv boolean, _se boolean
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members m
    JOIN public.groups g ON g.id = m.group_id
    WHERE m.id = _id
      AND (
        g.owner_id = auth.uid()
        OR (
          m.user_id = auth.uid()
          AND m.rol IS NOT DISTINCT FROM _rol
          AND m.recipes_view IS NOT DISTINCT FROM _rv
          AND m.recipes_edit IS NOT DISTINCT FROM _re
          AND m.planner_view IS NOT DISTINCT FROM _pv
          AND m.planner_edit IS NOT DISTINCT FROM _pe
          AND m.shopping_view IS NOT DISTINCT FROM _sv
          AND m.shopping_edit IS NOT DISTINCT FROM _se
          AND (
            m.status IS NOT DISTINCT FROM _status
            OR (m.status = 'uitgenodigd' AND _status = 'actief')
          )
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.groep_lid_update_ok(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.groep_lid_update_ok(uuid, text, text, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated, service_role;

DROP POLICY IF EXISTS group_members_update ON public.group_members;

CREATE POLICY group_members_update ON public.group_members
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.owner_id = auth.uid())
)
WITH CHECK (
  public.groep_lid_update_ok(
    id, rol, status,
    recipes_view, recipes_edit, planner_view, planner_edit, shopping_view, shopping_edit
  )
);