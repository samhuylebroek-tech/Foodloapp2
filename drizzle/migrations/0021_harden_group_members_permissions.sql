CREATE OR REPLACE FUNCTION public.group_members_alleen_eigen_delen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _eigenaar uuid;
BEGIN
  SELECT owner_id INTO _eigenaar FROM public.groups WHERE id = OLD.group_id;
  IF auth.uid() IS DISTINCT FROM _eigenaar THEN
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Je kan enkel je eigen instellingen aanpassen.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.recipes_view IS DISTINCT FROM OLD.recipes_view
       OR NEW.recipes_edit IS DISTINCT FROM OLD.recipes_edit
       OR NEW.planner_view IS DISTINCT FROM OLD.planner_view
       OR NEW.planner_edit IS DISTINCT FROM OLD.planner_edit
       OR NEW.shopping_view IS DISTINCT FROM OLD.shopping_view
       OR NEW.shopping_edit IS DISTINCT FROM OLD.shopping_edit THEN
      RAISE EXCEPTION 'Alleen de eigenaar van het gezin kan rechten aanpassen.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.group_members_alleen_eigen_delen() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_members_geen_rolwissel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.groep_eigenaar_lid() FROM PUBLIC, anon, authenticated;
