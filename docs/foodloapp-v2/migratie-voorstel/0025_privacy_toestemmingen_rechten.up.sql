-- VOORSTEL — NIET UITGEVOERD (vraagt akkoord van de eigenaar: nieuwe tabel + RLS-wijziging).
-- Fase 8: privacy, toestemmingen en beveiliging.
--
-- 1. BUG-164 — gezinsrecht keek naar de rechten van de EIGENAAR van een rij, niet naar die van de
--    kijker. public.groep_recht(_owner, _viewer, perm) (drizzle 0024) gaf daardoor elk actief
--    gezinslid schrijfrecht op de eigen (niet-gezins)spullen van iemand anders, zodra die eigenaar
--    zelf "bewerken" had, ook een lid dat zelf alleen mag bekijken (kijker, kind).
--    Fix (kleinst mogelijk, gedrag "ik deel mijn spullen met het gezin" blijft):
--    - bekijken: zoals nu (wat de eigenaar deelt, ziet elk actief lid);
--    - bewerken: de eigenaar deelt het om te bewerken ÉN de kijker zelf heeft dat recht in het
--      gezin. Een kijker of kind kan dus niets meer wijzigen of wissen bij een ander.
--    has_share() blijft ongewijzigd (gebruikt groep_recht).
-- 2. Toestemmingen per persoon (Instellingen › Privacy & toestemmingen): AI, analyse, community,
--    meldingen. Alleen de eigen rijen; nooit leesbaar voor gezin, makers of beheer via de app.
--    Gezondheid en gezin hebben al hun eigen bron (persoonlijke_voeding.toestemming_op,
--    group_members) en staan hier dus niet dubbel.
-- 3. Sessies: je eigen aanmeldingen (auth.sessions) zien en er één afmelden. Supabase heeft
--    daarvoor geen client-API; deze twee SECURITY DEFINER-functies geven alleen de eigen sessies,
--    zonder IP-adres, en wissen alleen een eigen sessie (refresh-tokens volgen via CASCADE).
--
-- Lokaal getest met tests/rls/privacy-0025.mjs en tests/rls/account-verwijderen.mjs (PGlite):
-- het lek wordt aangetoond op de huidige migraties en is dicht na 0025; heen + terug geeft
-- exact de huidige stand. Terugdraaien: 0025_privacy_toestemmingen_rechten.down.sql.

BEGIN;

-- ---------- 1. BUG-164: bewerken vraagt ook het recht van de kijker ----------
CREATE OR REPLACE FUNCTION public.groep_recht(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members o
    JOIN public.group_members v ON v.group_id = o.group_id AND v.user_id = _viewer AND v.status = 'actief'
    WHERE o.user_id = _owner AND o.status = 'actief'
      AND CASE _perm
        WHEN 'recipes_view'  THEN o.recipes_view OR o.recipes_edit
        WHEN 'recipes_edit'  THEN o.recipes_edit AND v.recipes_edit
        WHEN 'planner_view'  THEN o.planner_view OR o.planner_edit
        WHEN 'planner_edit'  THEN o.planner_edit AND v.planner_edit
        WHEN 'shopping_view' THEN o.shopping_view OR o.shopping_edit
        WHEN 'shopping_edit' THEN o.shopping_edit AND v.shopping_edit
        ELSE false END
  );
$$;
-- (CREATE OR REPLACE behoudt de bestaande rechten uit drizzle 0014.)

-- ---------- 2. toestemmingen ----------
CREATE TABLE public.toestemmingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL CHECK (soort IN ('ai', 'analyse', 'community', 'meldingen')),
  aan boolean NOT NULL,
  -- Voor AI: welke gegevens mogen mee. 'minimaal' = alleen recepttekst en neutrale smaakwensen
  -- (voorAI), nooit gezondheid. Andere soorten: NULL.
  niveau text CHECK (niveau IS NULL OR niveau IN ('minimaal')),
  sinds timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, soort)
);
ALTER TABLE public.toestemmingen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.toestemmingen FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toestemmingen TO authenticated;
GRANT ALL ON public.toestemmingen TO service_role;
CREATE POLICY toestemmingen_eigen ON public.toestemmingen FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Niemand kan de toestemming van iemand anders zetten, ook niet via een vervalste user_id.
CREATE OR REPLACE FUNCTION public.toestemming_vast_eigenaar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id kan niet veranderen' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER toestemmingen_vast_eigenaar BEFORE UPDATE ON public.toestemmingen
  FOR EACH ROW EXECUTE FUNCTION public.toestemming_vast_eigenaar();

-- ---------- 3. sessies: eigen aanmeldingen zien en afmelden ----------
CREATE OR REPLACE FUNCTION public.mijn_aanmeldingen()
RETURNS TABLE (id uuid, created_at timestamptz, refreshed_at timestamptz, user_agent text, aal text, huidige boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT s.id, s.created_at, s.refreshed_at::timestamptz, left(s.user_agent, 200), s.aal::text,
         s.id::text = coalesce(auth.jwt() ->> 'session_id', '')
  FROM auth.sessions s
  WHERE auth.uid() IS NOT NULL AND s.user_id = auth.uid()
  ORDER BY coalesce(s.refreshed_at::timestamptz, s.created_at) DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.meld_aanmelding_af(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld' USING ERRCODE = '42501'; END IF;
  DELETE FROM auth.sessions WHERE id = _id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'sessie niet gevonden'; END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mijn_aanmeldingen() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.meld_aanmelding_af(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mijn_aanmeldingen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.meld_aanmelding_af(uuid) TO authenticated;

COMMIT;
