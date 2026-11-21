-- Terugdraaien van 0018 (BUG-163): exact de regel van drizzle 0024 terug. Daarna kan elk
-- gezinslid weer alles op de gezinslijst (het lek is dan terug). Geen gegevens gaan verloren.
BEGIN;
DROP TRIGGER IF EXISTS gezinslijst_alleen_afvinken ON public.shopping_items;
DROP FUNCTION IF EXISTS public.gezinslijst_alleen_afvinken();
DROP POLICY IF EXISTS shopping_items_gezin_insert ON public.shopping_items;
DROP POLICY IF EXISTS shopping_items_gezin_delete ON public.shopping_items;
DROP POLICY IF EXISTS shopping_items_gezin_update ON public.shopping_items;
DROP POLICY IF EXISTS shopping_items_write ON public.shopping_items;
CREATE POLICY shopping_items_write ON public.shopping_items FOR ALL TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_edit'))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'shopping_edit'));
CREATE POLICY shopping_items_gezin_write ON public.shopping_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = shopping_items.list_id
      AND l.group_id IS NOT NULL
      AND public.in_groep(auth.uid(), l.group_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = shopping_items.list_id
      AND l.group_id IS NOT NULL
      AND public.in_groep(auth.uid(), l.group_id)
  ));
DROP FUNCTION IF EXISTS public.gezinslijst_mag_bewerken(uuid);
DROP FUNCTION IF EXISTS public.gezinslijst_mag_afvinken(uuid);
DROP FUNCTION IF EXISTS public.is_gezinslijst(uuid);
COMMIT;
