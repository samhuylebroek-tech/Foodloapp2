-- VOORSTEL — NIET UITGEVOERD (vraagt akkoord van de eigenaar: RLS-wijziging). BUG-163.
--
-- Probleem: de regel shopping_items_gezin_write (drizzle 0024) laat ELK gezinslid alles doen op
-- de gezinslijst: toevoegen, aanpassen en weghalen. Een lid met alleen "bekijken"
-- (shopping_edit = false, bv. oma als kijker of een kind) kan dus via de API producten wissen,
-- ook al toont de app die knoppen niet meer (P5).
--
-- Voorstel:
-- - toevoegen en weghalen op een gezinslijst: alleen de eigenaar van het gezin of een actief lid
--   met shopping_edit;
-- - aanpassen: idem, MAAR afvinken (alleen de kolom "checked") mag elk actief lid — dat is
--   precies wat een kijker in de winkel moet kunnen. Een trigger weigert voor een kijker elke
--   andere kolomwijziging (RLS kan niet per kolom kiezen);
-- - lezen blijft zoals het is (shopping_items_gezin_select).
-- Eigen lijsten (zonder group_id) en gedeelde lijsten via "shares" veranderen niet.
--
-- Lokaal getest met tests/rls/gezinslijst-kijker.mjs (PGlite): toont het lek op de huidige
-- migraties en bewijst de fix; heen + terug geeft exact de huidige stand.
-- Terugdraaien: 0018_gezinslijst_kijker.down.sql.

BEGIN;

-- Mag auth.uid() deze gezinslijst bewerken (niet alleen afvinken)?
CREATE OR REPLACE FUNCTION public.gezinslijst_mag_bewerken(_list uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists l
    JOIN public.groups g ON g.id = l.group_id
    WHERE l.id = _list
      AND (
        g.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.group_members m
          WHERE m.group_id = l.group_id
            AND m.user_id = auth.uid()
            AND m.status = 'actief'
            AND m.shopping_edit
        )
      )
  );
$$;

-- Mag auth.uid() op deze gezinslijst afvinken (elk actief lid)?
CREATE OR REPLACE FUNCTION public.gezinslijst_mag_afvinken(_list uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shopping_lists l
    JOIN public.groups g ON g.id = l.group_id
    WHERE l.id = _list
      AND (
        g.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.group_members m
          WHERE m.group_id = l.group_id AND m.user_id = auth.uid() AND m.status = 'actief'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.gezinslijst_mag_bewerken(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gezinslijst_mag_afvinken(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gezinslijst_mag_bewerken(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gezinslijst_mag_afvinken(uuid) TO authenticated;

-- Is dit een gezinslijst?
CREATE OR REPLACE FUNCTION public.is_gezinslijst(_list uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = _list AND l.group_id IS NOT NULL);
$$;
REVOKE EXECUTE ON FUNCTION public.is_gezinslijst(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gezinslijst(uuid) TO authenticated;

DROP POLICY IF EXISTS shopping_items_gezin_write ON public.shopping_items;

-- Ook de algemene deelregel (has_share → groep_recht) gaf elk gezinslid schrijfrecht op items
-- van een ander lid, en zelf toevoegen (user_id = jij), dus ook op de gezinslijst. Op een
-- gezinslijst gelden voortaan alleen de regels hieronder. Eigen en via "shares" gedeelde
-- lijsten: ongewijzigd (has_share geeft de eigenaar zelf altijd toegang).
DROP POLICY IF EXISTS shopping_items_write ON public.shopping_items;
CREATE POLICY shopping_items_write ON public.shopping_items FOR ALL TO authenticated
  USING (public.has_share(user_id, auth.uid(), 'shopping_edit') AND NOT public.is_gezinslijst(list_id))
  WITH CHECK (public.has_share(user_id, auth.uid(), 'shopping_edit') AND NOT public.is_gezinslijst(list_id));

CREATE POLICY shopping_items_gezin_insert ON public.shopping_items
  FOR INSERT TO authenticated
  WITH CHECK (public.gezinslijst_mag_bewerken(list_id));

CREATE POLICY shopping_items_gezin_delete ON public.shopping_items
  FOR DELETE TO authenticated
  USING (public.gezinslijst_mag_bewerken(list_id));

-- Afvinken mag elk actief lid; de trigger hieronder houdt de rest tegen voor een kijker.
CREATE POLICY shopping_items_gezin_update ON public.shopping_items
  FOR UPDATE TO authenticated
  USING (public.gezinslijst_mag_afvinken(list_id))
  WITH CHECK (public.gezinslijst_mag_afvinken(list_id));

CREATE OR REPLACE FUNCTION public.gezinslijst_alleen_afvinken()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Alleen voor gezinslijsten en alleen voor wie niet mag bewerken; eigen lijsten en de
  -- eigenaar of bewerkers zijn vrij. Service-rol (auth.uid() leeg) wordt niet beperkt.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shopping_lists l WHERE l.id = OLD.list_id AND l.group_id IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  -- Eigen item via de gewone regels (has_share / eigenaar van het item): niet beperken.
  IF OLD.user_id = auth.uid() THEN RETURN NEW; END IF;
  IF public.gezinslijst_mag_bewerken(OLD.list_id) THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'checked' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'checked' - 'updated_at') THEN
    RAISE EXCEPTION 'Op deze gezinslijst mag je alleen afvinken' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gezinslijst_alleen_afvinken ON public.shopping_items;
CREATE TRIGGER gezinslijst_alleen_afvinken
  BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.gezinslijst_alleen_afvinken();

COMMIT;
