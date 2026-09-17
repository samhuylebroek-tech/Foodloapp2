CREATE OR REPLACE FUNCTION public.group_members_geen_zelf_escalatie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  eigenaar uuid;
BEGIN
  -- server-side beheer (service role / achtergrondtaken) heeft geen sessiegebruiker
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT g.owner_id INTO eigenaar FROM public.groups g WHERE g.id = OLD.group_id;

  IF eigenaar = auth.uid() THEN
    IF NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Lidmaatschap kan niet verplaatst worden';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    IF NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.rol IS DISTINCT FROM OLD.rol
       OR NEW.recipes_view IS DISTINCT FROM OLD.recipes_view
       OR NEW.recipes_edit IS DISTINCT FROM OLD.recipes_edit
       OR NEW.planner_view IS DISTINCT FROM OLD.planner_view
       OR NEW.planner_edit IS DISTINCT FROM OLD.planner_edit
       OR NEW.shopping_view IS DISTINCT FROM OLD.shopping_view
       OR NEW.shopping_edit IS DISTINCT FROM OLD.shopping_edit THEN
      RAISE EXCEPTION 'Je kan je eigen rol of rechten niet aanpassen';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'uitgenodigd' AND NEW.status IN ('actief', 'geweigerd')) THEN
      RAISE EXCEPTION 'Alleen een uitnodiging aanvaarden of weigeren is toegestaan';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Geen toegang tot dit lidmaatschap';
END;
$$;