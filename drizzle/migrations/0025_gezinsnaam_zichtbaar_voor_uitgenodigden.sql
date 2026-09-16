-- Wie uitgenodigd is (nog niet actief) mag de naam van het gezin zien om te kunnen antwoorden
CREATE POLICY groups_select_uitgenodigd ON public.groups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = groups.id AND m.user_id = auth.uid()
  ));