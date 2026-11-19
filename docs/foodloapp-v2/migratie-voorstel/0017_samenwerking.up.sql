-- VOORSTEL — NIET UITGEVOERD. P5 Samenwerking: lijst verdelen, meldingen in de app,
-- activiteitslog per gezin en de keuzes welke meldingen je wilt.
--
-- Conflictcontrole (gelijktijdige wijziging) heeft GEEN schemawijziging nodig: de app vergelijkt
-- de inhoud van de rij vlak vóór het schrijven (src/lib/samenwerking/conflict.ts). Bestaande
-- tabellen (meal_plan, shopping_items, shopping_lists) blijven ongewijzigd.
--
-- Regels:
-- - lijst_toewijzingen: wie haalt wat / in welke winkel. Op een gezinslijst lezen alle actieve
--   leden van dat gezin; schrijven alleen actieve leden met shopping_edit (kijkers niet).
--   Toewijzen aan iemand kan alleen aan een actief lid van hetzelfde gezin, en alleen op de
--   gezinslijst. Op een eigen lijst: alleen de eigenaar, en alleen een winkel.
-- - app_meldingen: alleen de ontvanger leest, markeert als gelezen (enige kolom die mag
--   veranderen) en wist. Maken: voor jezelf, of voor een actief lid van een gezin waarvan jij
--   ook actief lid bent (actor = jij). Geen externe links; tekst max. 200 tekens.
-- - gezin_activiteit: alleen actieve leden van het gezin lezen; maken alleen als jezelf (actor)
--   en als actief lid. Niemand wijzigt of wist (log); verdwijnt met het gezin of het account.
-- - app_melding_instellingen: alleen de eigen rij (zoals 0016).
-- - Geen gezondheidsgegevens: de app haalt elke reden (allergie, dieet) uit meldingteksten.
-- - Bewaartermijn: meldingen en log ouder dan 90 dagen mogen opgeruimd worden
--   (public.ruim_samenwerking_op(), aan te roepen door een geplande taak; niet automatisch).
--
-- Lokaal getest met tests/rls/samenwerking.mjs (PGlite). Terugdraaien: 0017_…down.sql.

BEGIN;

-- ---------- hulpfunctie: actief lid van dit gezin (auth.uid()) ----------
CREATE OR REPLACE FUNCTION public.samenwerking_is_lid(_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = _group AND m.user_id = auth.uid() AND m.status = 'actief'
  );
$$;

-- Mag auth.uid() de gezinslijst _list bewerken (actief lid met shopping_edit, of de eigenaar
-- van een eigen lijst)?
CREATE OR REPLACE FUNCTION public.samenwerking_mag_lijst_bewerken(_list uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = _list AND (
      (l.group_id IS NULL AND l.user_id = auth.uid())
      OR (l.group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = l.group_id AND m.user_id = auth.uid()
          AND m.status = 'actief' AND m.shopping_edit
      ))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.samenwerking_mag_lijst_zien(_list uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shopping_lists l
    WHERE l.id = _list AND (
      (l.group_id IS NULL AND l.user_id = auth.uid())
      OR (l.group_id IS NOT NULL AND public.samenwerking_is_lid(l.group_id))
    )
  );
$$;

REVOKE ALL ON FUNCTION public.samenwerking_is_lid(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.samenwerking_mag_lijst_bewerken(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.samenwerking_mag_lijst_zien(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.samenwerking_is_lid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.samenwerking_mag_lijst_bewerken(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.samenwerking_mag_lijst_zien(uuid) TO authenticated;

-- ---------- lijst verdelen ----------
CREATE TABLE public.lijst_toewijzingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL UNIQUE REFERENCES public.shopping_items(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  toegewezen_aan uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winkel text CHECK (winkel IS NULL OR char_length(btrim(winkel)) BETWEEN 1 AND 30),
  toegewezen_door uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  CHECK (toegewezen_aan IS NOT NULL OR winkel IS NOT NULL)
);
CREATE INDEX lijst_toewijzingen_lijst_idx ON public.lijst_toewijzingen (list_id);

-- Het item moet op die lijst staan; toewijzen aan iemand alleen op een gezinslijst en alleen
-- aan een actief lid van dat gezin.
CREATE OR REPLACE FUNCTION public.lijst_toewijzing_geldig()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _groep uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shopping_items i WHERE i.id = NEW.item_id AND i.list_id = NEW.list_id) THEN
    RAISE EXCEPTION 'item staat niet op deze lijst' USING ERRCODE = '23514';
  END IF;
  IF NEW.toegewezen_aan IS NOT NULL THEN
    SELECT l.group_id INTO _groep FROM public.shopping_lists l WHERE l.id = NEW.list_id;
    IF _groep IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = _groep AND m.user_id = NEW.toegewezen_aan AND m.status = 'actief'
    ) THEN
      RAISE EXCEPTION 'alleen aan een actief gezinslid' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.toegewezen_door := auth.uid();
  NEW.bijgewerkt_op := now();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.lijst_toewijzing_geldig() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lijst_toewijzingen_geldig BEFORE INSERT OR UPDATE ON public.lijst_toewijzingen
  FOR EACH ROW EXECUTE FUNCTION public.lijst_toewijzing_geldig();

ALTER TABLE public.lijst_toewijzingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lijst_toewijzingen FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lijst_toewijzingen TO authenticated;
CREATE POLICY lijst_toewijzingen_lezen ON public.lijst_toewijzingen
  FOR SELECT TO authenticated USING (public.samenwerking_mag_lijst_zien(list_id));
CREATE POLICY lijst_toewijzingen_maken ON public.lijst_toewijzingen
  FOR INSERT TO authenticated WITH CHECK (public.samenwerking_mag_lijst_bewerken(list_id));
CREATE POLICY lijst_toewijzingen_wijzigen ON public.lijst_toewijzingen
  FOR UPDATE TO authenticated
  USING (public.samenwerking_mag_lijst_bewerken(list_id))
  WITH CHECK (public.samenwerking_mag_lijst_bewerken(list_id));
CREATE POLICY lijst_toewijzingen_wissen ON public.lijst_toewijzingen
  FOR DELETE TO authenticated USING (public.samenwerking_mag_lijst_bewerken(list_id));

-- ---------- meldingen in de app ----------
CREATE TABLE public.app_meldingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL CHECK (soort IN ('menu','toegewezen','winkelen-klaar','restje','conflict')),
  tekst text NOT NULL CHECK (char_length(btrim(tekst)) BETWEEN 1 AND 200),
  link text CHECK (link IS NULL OR (link ~ '^/[^/]' AND char_length(link) <= 200)),
  sleutel text CHECK (sleutel IS NULL OR char_length(sleutel) <= 120),
  gelezen_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_meldingen_ontvanger_idx ON public.app_meldingen (user_id, created_at DESC);
CREATE UNIQUE INDEX app_meldingen_sleutel_uniek ON public.app_meldingen (user_id, sleutel)
  WHERE sleutel IS NOT NULL;

ALTER TABLE public.app_meldingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_meldingen FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.app_meldingen TO authenticated;
-- Alleen "gelezen" mag veranderen (kolomrecht): tekst, afzender en ontvanger liggen vast.
GRANT UPDATE (gelezen_op) ON public.app_meldingen TO authenticated;
CREATE POLICY app_meldingen_lezen ON public.app_meldingen
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY app_meldingen_maken ON public.app_meldingen
  FOR INSERT TO authenticated WITH CHECK (
    actor_id = auth.uid() AND (
      (user_id = auth.uid() AND group_id IS NULL)
      OR (group_id IS NOT NULL AND public.samenwerking_is_lid(group_id) AND EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = app_meldingen.group_id AND m.user_id = app_meldingen.user_id
          AND m.status = 'actief'
      ))
    )
  );
CREATE POLICY app_meldingen_gelezen ON public.app_meldingen
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY app_meldingen_wissen ON public.app_meldingen
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- wie veranderde wat ----------
CREATE TABLE public.gezin_activiteit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL CHECK (soort IN ('menu','lijst','toewijzing','winkelen','conflict')),
  tekst text NOT NULL CHECK (char_length(btrim(tekst)) BETWEEN 1 AND 200),
  datum date NOT NULL DEFAULT current_date,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gezin_activiteit_week_idx ON public.gezin_activiteit (group_id, datum);
CREATE INDEX gezin_activiteit_ref_idx ON public.gezin_activiteit (ref_id);

ALTER TABLE public.gezin_activiteit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gezin_activiteit FROM anon, authenticated;
GRANT SELECT, INSERT ON public.gezin_activiteit TO authenticated;
CREATE POLICY gezin_activiteit_lezen ON public.gezin_activiteit
  FOR SELECT TO authenticated USING (public.samenwerking_is_lid(group_id));
CREATE POLICY gezin_activiteit_maken ON public.gezin_activiteit
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND public.samenwerking_is_lid(group_id));

-- ---------- welke meldingen je wilt ----------
CREATE TABLE public.app_melding_instellingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  uit text[] NOT NULL DEFAULT '{}' CHECK (
    uit <@ ARRAY['menu','toegewezen','winkelen-klaar','restje','conflict']::text[]
  ),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_melding_instellingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_melding_instellingen FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_melding_instellingen TO authenticated;
CREATE POLICY app_melding_instellingen_eigen ON public.app_melding_instellingen
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- opruimen (90 dagen), alleen voor de beheerrol / geplande taak ----------
CREATE OR REPLACE FUNCTION public.ruim_samenwerking_op()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; m integer;
BEGIN
  DELETE FROM public.app_meldingen WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.gezin_activiteit WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS m = ROW_COUNT;
  RETURN n + m;
END; $$;
REVOKE ALL ON FUNCTION public.ruim_samenwerking_op() FROM PUBLIC, anon, authenticated;

-- Realtime: de bel en "wie haalt wat" verversen meteen (RLS blijft gelden).
ALTER TABLE public.app_meldingen REPLICA IDENTITY FULL;
ALTER TABLE public.lijst_toewijzingen REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_meldingen, public.lijst_toewijzingen;
  END IF;
END $$;

COMMIT;
