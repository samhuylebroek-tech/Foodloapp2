-- VOORSTEL — NIET UITGEVOERD. Fase 3: restjes op het account en gedeeld met het gezin.
--
-- restjes (één rij per bewaard restje):
-- - wie het bewaarde (user_id), optioneel het gezin (group_id), de naam van het gerecht, het
--   recept (optioneel), porties, kookdatum, eventueel de dag waarop het gepland is, en de afloop:
--   'bewaard', 'opgegeten' of 'weggegooid' (met datum, voor het kleine overzicht per maand).
-- - Geen gezondheidsgegevens: alleen naam, porties en datums. Niet in pantry_items: een restje
--   "spaghetti bolognese" is geen "spaghetti in huis".
-- Rechten (RLS):
-- - lezen: je eigen restjes, en die van een gezin waarvan je ACTIEF lid bent;
-- - maken: alleen op eigen naam; met een gezin alleen als je daar actief lid van bent; een
--   gekoppeld recept moet je zelf mogen zien (RLS van recipes in de subquery);
-- - wijzigen (plannen, opgegeten/weggegooid): de maker of een actief lid van dat gezin; de maker,
--   het gezin en het recept kunnen daarbij niet veranderen (trigger);
-- - wissen (ongedaan maken van bewaren): alleen de maker.
-- - Account weg = eigen restjes weg; gezin weg = restjes blijven, zonder gezin.
-- - Bewaartermijn: afgesloten restjes ouder dan 400 dagen en bewaarde ouder dan 30 dagen mogen
--   opgeruimd worden (public.ruim_restjes_op(), aan te roepen door een geplande taak).
--
-- De app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en bewaart
-- anders op het toestel. Lokaal getest met tests/rls/restjes.mjs (PGlite).
-- Terugdraaien: 0019_restjes.down.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.restjes_is_lid(_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = _group AND m.user_id = auth.uid() AND m.status = 'actief'
  ) OR EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = _group AND g.owner_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.restjes_is_lid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restjes_is_lid(uuid) TO authenticated;

CREATE TABLE public.restjes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  titel text NOT NULL CHECK (char_length(btrim(titel)) BETWEEN 1 AND 120),
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  porties smallint NOT NULL CHECK (porties BETWEEN 1 AND 12),
  gekookt_op timestamptz NOT NULL DEFAULT now(),
  gepland_op date,
  status text NOT NULL DEFAULT 'bewaard' CHECK (status IN ('bewaard', 'opgegeten', 'weggegooid')),
  afgesloten_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'bewaard') = (afgesloten_op IS NULL))
);
CREATE INDEX restjes_user_idx ON public.restjes (user_id, gekookt_op DESC);
CREATE INDEX restjes_group_idx ON public.restjes (group_id, gekookt_op DESC) WHERE group_id IS NOT NULL;

-- Bij wijzigen blijven maker, gezin, recept, naam en kookdatum vast (alleen plannen en afloop).
CREATE OR REPLACE FUNCTION public.restjes_vaste_velden()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- ON DELETE SET NULL (gezin of recept weg) loopt via een eigen trigger: dat mag.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.recipe_id IS DISTINCT FROM OLD.recipe_id
     OR (OLD.user_id <> auth.uid() AND (NEW.titel IS DISTINCT FROM OLD.titel
         OR NEW.porties IS DISTINCT FROM OLD.porties OR NEW.gekookt_op IS DISTINCT FROM OLD.gekookt_op))
  THEN
    RAISE EXCEPTION 'restje: deze velden kunnen niet veranderen' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restjes_vaste_velden BEFORE UPDATE ON public.restjes
  FOR EACH ROW EXECUTE FUNCTION public.restjes_vaste_velden();

ALTER TABLE public.restjes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restjes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restjes TO authenticated;
GRANT ALL ON public.restjes TO service_role;

CREATE POLICY restjes_lezen ON public.restjes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (group_id IS NOT NULL AND public.restjes_is_lid(group_id)));
CREATE POLICY restjes_maken ON public.restjes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (group_id IS NULL OR public.restjes_is_lid(group_id))
    AND (recipe_id IS NULL OR EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id))
  );
CREATE POLICY restjes_wijzigen ON public.restjes FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (group_id IS NOT NULL AND public.restjes_is_lid(group_id)))
  WITH CHECK (user_id = auth.uid() OR (group_id IS NOT NULL AND public.restjes_is_lid(group_id)));
CREATE POLICY restjes_wissen ON public.restjes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ruim_restjes_op()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.restjes
  WHERE (status <> 'bewaard' AND afgesloten_op < now() - interval '400 days')
     OR (status = 'bewaard' AND gekookt_op < now() - interval '30 days');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ruim_restjes_op() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ruim_restjes_op() TO service_role;

COMMIT;
