-- Gedeelde gezinsspullen: weekmenu, boodschappenlijst en uitnodigingen met status

ALTER TABLE public.meal_plan ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.shopping_lists ADD COLUMN group_id uuid REFERENCES public.groups(id);
ALTER TABLE public.group_members ADD COLUMN status text NOT NULL DEFAULT 'actief';

-- Enkel actieve leden tellen mee als groepslid
CREATE OR REPLACE FUNCTION public.in_groep(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = _group AND m.user_id = _user AND m.status = 'actief'
  );
$$;

CREATE OR REPLACE FUNCTION public.samen_in_groep(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members x
    JOIN public.group_members y ON y.group_id = x.group_id
    WHERE x.user_id = _a AND y.user_id = _b
      AND x.status = 'actief' AND y.status = 'actief'
  );
$$;

CREATE OR REPLACE FUNCTION public.groep_recht(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members o
    JOIN public.group_members v ON v.group_id = o.group_id AND v.user_id = _viewer AND v.status = 'actief'
    WHERE o.user_id = _owner AND o.status = 'actief'
      AND CASE _perm
        WHEN 'recipes_view'  THEN o.recipes_view OR o.recipes_edit
        WHEN 'recipes_edit'  THEN o.recipes_edit
        WHEN 'planner_view'  THEN o.planner_view OR o.planner_edit
        WHEN 'planner_edit'  THEN o.planner_edit
        WHEN 'shopping_view' THEN o.shopping_view OR o.shopping_edit
        WHEN 'shopping_edit' THEN o.shopping_edit
        ELSE false END
  );
$$;

-- Elk nieuw gezin krijgt meteen een gezamenlijke boodschappenlijst
CREATE OR REPLACE FUNCTION public.groep_gezinslijst()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.shopping_lists (user_id, name, group_id)
  VALUES (NEW.owner_id, 'Gezinslijst', NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER groups_gezinslijst
  AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.groep_gezinslijst();

-- Bestaande gezinnen krijgen ook een gezinslijst
INSERT INTO public.shopping_lists (user_id, name, group_id)
SELECT g.owner_id, 'Gezinslijst', g.id
FROM public.groups g
WHERE NOT EXISTS (SELECT 1 FROM public.shopping_lists sl WHERE sl.group_id = g.id);

-- Bestaand lid nodigt iemand uit: rij start als 'uitgenodigd'
CREATE OR REPLACE FUNCTION public.nodig_gezinslid(_group uuid, _user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  IF NOT public.in_groep(auth.uid(), _group) THEN RAISE EXCEPTION 'geen lid van dit gezin'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'dat ben je zelf'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user) THEN RAISE EXCEPTION 'gebruiker niet gevonden'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _group AND m.user_id = _user) THEN
    RAISE EXCEPTION 'al uitgenodigd of al lid';
  END IF;
  INSERT INTO public.group_members (group_id, user_id, rol, status)
  VALUES (_group, _user, 'lid', 'uitgenodigd');
  RETURN _group;
END; $$;

-- Uitgenodigde neemt de uitnodiging aan
CREATE OR REPLACE FUNCTION public.accepteer_gezin(_group uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  UPDATE public.group_members
     SET status = 'actief'
   WHERE group_id = _group AND user_id = auth.uid() AND status = 'uitgenodigd';
  IF NOT FOUND THEN RAISE EXCEPTION 'uitnodiging niet gevonden'; END IF;
  RETURN _group;
END; $$;

-- Wie via de link/QR binnenkomt terwijl hij uitgenodigd was, wordt meteen actief
CREATE OR REPLACE FUNCTION public.join_group(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  SELECT * INTO g FROM public.groups WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'groep niet gevonden'; END IF;
  INSERT INTO public.group_members (group_id, user_id, rol, status)
  VALUES (g.id, auth.uid(), 'lid', 'actief')
  ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'actief';
  RETURN g.id;
END; $$;

-- RLS: gezamenlijk weekmenu
CREATE POLICY meal_plan_gezin_select ON public.meal_plan
  FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id));

CREATE POLICY meal_plan_gezin_write ON public.meal_plan
  FOR ALL TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id))
  WITH CHECK (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id));

-- RLS: gezamenlijke boodschappenlijst
CREATE POLICY shopping_lists_gezin_select ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id));

CREATE POLICY shopping_lists_gezin_write ON public.shopping_lists
  FOR ALL TO authenticated
  USING (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id))
  WITH CHECK (group_id IS NOT NULL AND public.in_groep(auth.uid(), group_id));

CREATE POLICY shopping_items_gezin_select ON public.shopping_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = shopping_items.list_id
      AND l.group_id IS NOT NULL
      AND public.in_groep(auth.uid(), l.group_id)
  ));

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

-- Realtime voor uitnodigingen, gezinsmenu en gezinslijst
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.meal_plan REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plan;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;

REVOKE EXECUTE ON FUNCTION public.groep_gezinslijst() FROM PUBLIC, anon, authenticated;