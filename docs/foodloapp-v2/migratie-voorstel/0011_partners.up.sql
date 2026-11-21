-- VOORSTEL — NIET UITGEVOERD. Werkstroom D: partnerportaal, campagnes, gesponsorde inhoud,
-- samenwerkingen, geaggregeerde statistiek en partneraanvragen (MODULE_DESIGNS §10,
-- COMMERCIAL_ROADMAP §1). Vereist 0008 (creators, recipe_publicaties, is_openbaar_recept).
-- Regels:
-- - partnerleden zien en bewerken alleen de rijen van hun eigen organisatie, volgens hun rol
--   (zelfde matrix als src/lib/partners.ts: partner_mag);
-- - het Foodlo-team (is_admin) of de server zet verificatie en keurt campagnes goed; een partner
--   kan alleen 'concept' en 'ingediend' zetten (trigger bewaak_campagne);
-- - gesponsorde items zijn altijd gelabeld (CHECK) en een gesponsord recept moet openbaar en
--   goedgekeurd zijn (is_openbaar_recept);
-- - statistiek bevat alleen dagtotalen per campagne: geen enkele gebruikerskolom; tellen kan
--   alleen via gesponsord_tel() (+1 op het dagtotaal), lezen alleen met recht rapportage;
-- - er blijft altijd minstens één eigenaar per partner.
-- Ook: recipe_publicaties.moderatie_reden (uitleg bij afwijzen in /beheer/moderatie).
-- De app controleert eerst of de tabellen bestaan (module-beschikbaar.ts) en toont anders
-- "binnenkort". Lokaal getest met tests/rls/partners-premium.mjs (PGlite).
-- Terugdraaien: 0011_partners.down.sql.

BEGIN;

-- ---------- moderatie: reden bij afwijzen ----------
ALTER TABLE public.recipe_publicaties
  ADD COLUMN moderatie_reden text CHECK (moderatie_reden IS NULL OR char_length(moderatie_reden) <= 500);

CREATE OR REPLACE FUNCTION public.wis_moderatie_reden()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moderatie IS DISTINCT FROM 'afgewezen' THEN NEW.moderatie_reden := NULL; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER recipe_publicaties_reden BEFORE INSERT OR UPDATE ON public.recipe_publicaties
  FOR EACH ROW EXECUTE FUNCTION public.wis_moderatie_reden();

-- ---------- partners en leden ----------
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 2 AND 80),
  soort text NOT NULL CHECK (soort IN ('merk', 'producent', 'retail', 'restaurant')),
  website text CHECK (website IS NULL OR website ~ '^https://'),
  logo_url text,
  omschrijving text CHECK (omschrijving IS NULL OR char_length(omschrijving) <= 400),
  verificatie_status text NOT NULL DEFAULT 'aangevraagd'
    CHECK (verificatie_status IN ('aangevraagd', 'geverifieerd', 'geweigerd')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.partner_leden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('eigenaar', 'beheerder', 'analist', 'finance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, user_id)
);
CREATE INDEX partner_leden_user_idx ON public.partner_leden (user_id);

CREATE TABLE public.partner_aanvragen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bedrijfsnaam text NOT NULL CHECK (char_length(bedrijfsnaam) BETWEEN 2 AND 80),
  soort text NOT NULL CHECK (soort IN ('merk', 'producent', 'retail', 'restaurant')),
  website text CHECK (website IS NULL OR website ~ '^https://'),
  bericht text CHECK (bericht IS NULL OR char_length(bericht) <= 1000),
  status text NOT NULL DEFAULT 'nieuw'
    CHECK (status IN ('nieuw', 'in_behandeling', 'goedgekeurd', 'geweigerd')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- producten, campagnes, gesponsorde items ----------
CREATE TABLE public.partner_producten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 2 AND 120),
  ingredient_koppeling text NOT NULL CHECK (char_length(ingredient_koppeling) BETWEEN 2 AND 80),
  ean text CHECK (ean IS NULL OR ean ~ '^([0-9]{8}|[0-9]{12,14})$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_producten_ingredient_idx ON public.partner_producten (lower(ingredient_koppeling));

CREATE TABLE public.campagnes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 2 AND 120),
  status text NOT NULL DEFAULT 'concept'
    CHECK (status IN ('concept', 'ingediend', 'goedgekeurd', 'actief', 'afgelopen')),
  start date,
  einde date,
  doel text CHECK (doel IS NULL OR char_length(doel) <= 300),
  beoordeling_reden text CHECK (beoordeling_reden IS NULL OR char_length(beoordeling_reden) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (einde IS NULL OR start IS NULL OR einde >= start)
);
CREATE INDEX campagnes_lopend_idx ON public.campagnes (start) WHERE status IN ('goedgekeurd', 'actief');

CREATE TABLE public.gesponsorde_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id uuid NOT NULL REFERENCES public.campagnes(id) ON DELETE CASCADE,
  soort text NOT NULL CHECK (soort IN ('recept', 'product')),
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  product_naam text CHECK (product_naam IS NULL OR char_length(product_naam) <= 120),
  -- Commercieel is altijd herkenbaar gelabeld.
  label_tekst text NOT NULL DEFAULT 'Gesponsord'
    CHECK (label_tekst ~* '^(gesponsord|advertentie|in samenwerking met)'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((soort = 'recept' AND recipe_id IS NOT NULL) OR (soort = 'product' AND product_naam IS NOT NULL))
);
CREATE INDEX gesponsorde_items_campagne_idx ON public.gesponsorde_items (campagne_id);

-- ---------- samenwerkingen en statistiek ----------
CREATE TABLE public.samenwerkingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'voorstel' CHECK (status IN ('voorstel', 'lopend', 'afgerond')),
  omschrijving text CHECK (omschrijving IS NULL OR char_length(omschrijving) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, creator_id)
);

-- Alleen dagtotalen: bewust GEEN user_id of andere persoonskolom.
CREATE TABLE public.gesponsord_statistiek (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id uuid NOT NULL REFERENCES public.campagnes(id) ON DELETE CASCADE,
  dag date NOT NULL,
  vertoningen integer NOT NULL DEFAULT 0 CHECK (vertoningen >= 0),
  klikken integer NOT NULL DEFAULT 0 CHECK (klikken >= 0),
  UNIQUE (campagne_id, dag)
);

-- ---------- hulpfuncties ----------
CREATE OR REPLACE FUNCTION public.partner_rol(_partner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.partner_leden WHERE partner_id = _partner AND user_id = auth.uid();
$$;

-- Zelfde matrix als partnerMag() in src/lib/partners.ts.
CREATE OR REPLACE FUNCTION public.partner_mag(_partner uuid, _actie text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    CASE public.partner_rol(_partner)
      WHEN 'eigenaar' THEN true
      WHEN 'beheerder' THEN _actie IN ('profiel.bewerken', 'producten.bewerken', 'campagnes.bewerken', 'rapportage.zien')
      WHEN 'analist' THEN _actie = 'rapportage.zien'
      WHEN 'finance' THEN _actie IN ('rapportage.zien', 'abonnement.beheren')
    END, false);
$$;

CREATE OR REPLACE FUNCTION public.campagne_loopt(_campagne uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campagnes c JOIN public.partners p ON p.id = c.partner_id
     WHERE c.id = _campagne AND c.status IN ('goedgekeurd', 'actief')
       AND p.verificatie_status = 'geverifieerd'
       AND c.start <= current_date AND current_date <= c.einde
  );
$$;

CREATE OR REPLACE FUNCTION public.campagne_partner(_campagne uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id FROM public.campagnes WHERE id = _campagne;
$$;

CREATE OR REPLACE FUNCTION public.campagne_is_concept(_campagne uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campagnes WHERE id = _campagne AND status = 'concept');
$$;

REVOKE ALL ON FUNCTION public.partner_rol(uuid), public.partner_mag(uuid, text),
  public.campagne_loopt(uuid), public.campagne_partner(uuid), public.campagne_is_concept(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_rol(uuid), public.partner_mag(uuid, text),
  public.campagne_loopt(uuid), public.campagne_partner(uuid), public.campagne_is_concept(uuid)
  TO authenticated, service_role;

-- Een vertoning of klik tellen: +1 op het dagtotaal, alleen voor lopende campagnes. Er wordt
-- niets over de gebruiker bewaard.
CREATE OR REPLACE FUNCTION public.gesponsord_tel(_item uuid, _soort text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _campagne uuid;
BEGIN
  IF _soort NOT IN ('vertoning', 'klik') THEN RAISE EXCEPTION 'onbekende soort'; END IF;
  SELECT campagne_id INTO _campagne FROM public.gesponsorde_items WHERE id = _item;
  IF _campagne IS NULL OR NOT public.campagne_loopt(_campagne) THEN RETURN; END IF;
  INSERT INTO public.gesponsord_statistiek (campagne_id, dag, vertoningen, klikken)
  VALUES (_campagne, current_date, (_soort = 'vertoning')::int, (_soort = 'klik')::int)
  ON CONFLICT (campagne_id, dag) DO UPDATE
    SET vertoningen = gesponsord_statistiek.vertoningen + EXCLUDED.vertoningen,
        klikken = gesponsord_statistiek.klikken + EXCLUDED.klikken;
END; $$;
REVOKE ALL ON FUNCTION public.gesponsord_tel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gesponsord_tel(uuid, text) TO authenticated, service_role;

-- ---------- bewaking ----------
-- Verificatie zet alleen beheer of de server.
CREATE OR REPLACE FUNCTION public.bewaak_partner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.verificatie_status := OLD.verificatie_status;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER partners_bewaak BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.bewaak_partner();

-- Een partner zet alleen 'concept' of 'ingediend', en wijzigt alleen een concept.
CREATE OR REPLACE FUNCTION public.bewaak_campagne()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'concept';
    NEW.beoordeling_reden := NULL;
  ELSE
    IF OLD.status <> 'concept' THEN
      RAISE EXCEPTION 'Een ingediende of goedgekeurde campagne kan de partner niet meer wijzigen.';
    END IF;
    IF NEW.status NOT IN ('concept', 'ingediend') THEN
      RAISE EXCEPTION 'Alleen het Foodlo-team keurt campagnes goed.';
    END IF;
    NEW.partner_id := OLD.partner_id;
    NEW.beoordeling_reden := OLD.beoordeling_reden;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER campagnes_bewaak BEFORE INSERT OR UPDATE ON public.campagnes
  FOR EACH ROW EXECUTE FUNCTION public.bewaak_campagne();

-- Minstens één eigenaar per partner (behalve als de partner zelf verwijderd wordt).
CREATE OR REPLACE FUNCTION public.bewaak_eigenaar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.rol = 'eigenaar' AND (TG_OP = 'DELETE' OR NEW.rol <> 'eigenaar')
     AND EXISTS (SELECT 1 FROM public.partners WHERE id = OLD.partner_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.partner_leden
        WHERE partner_id = OLD.partner_id AND rol = 'eigenaar' AND id <> OLD.id) THEN
    RAISE EXCEPTION 'Er moet minstens één eigenaar blijven.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER partner_leden_eigenaar BEFORE UPDATE OR DELETE ON public.partner_leden
  FOR EACH ROW EXECUTE FUNCTION public.bewaak_eigenaar();

-- ---------- rechten ----------
REVOKE ALL ON public.partners, public.partner_leden, public.partner_aanvragen,
  public.partner_producten, public.campagnes, public.gesponsorde_items, public.samenwerkingen,
  public.gesponsord_statistiek FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_leden, public.partner_producten,
  public.campagnes, public.gesponsorde_items TO authenticated;
GRANT SELECT, INSERT ON public.partner_aanvragen TO authenticated;
GRANT SELECT ON public.samenwerkingen, public.gesponsord_statistiek TO authenticated;
GRANT ALL ON public.partners, public.partner_leden, public.partner_aanvragen,
  public.partner_producten, public.campagnes, public.gesponsorde_items, public.samenwerkingen,
  public.gesponsord_statistiek TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_leden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_aanvragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_producten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campagnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gesponsorde_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samenwerkingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gesponsord_statistiek ENABLE ROW LEVEL SECURITY;

-- Partners: eigen organisatie, beheer, of geverifieerde partners (naam bij een gesponsorde plek).
CREATE POLICY partners_lezen ON public.partners FOR SELECT TO authenticated
  USING (public.partner_rol(id) IS NOT NULL OR verificatie_status = 'geverifieerd' OR public.is_admin(auth.uid()));
CREATE POLICY partners_bewerken ON public.partners FOR UPDATE TO authenticated
  USING (public.partner_mag(id, 'profiel.bewerken') OR public.is_admin(auth.uid()))
  WITH CHECK (public.partner_mag(id, 'profiel.bewerken') OR public.is_admin(auth.uid()));

CREATE POLICY leden_lezen ON public.partner_leden FOR SELECT TO authenticated
  USING (public.partner_rol(partner_id) IS NOT NULL OR public.is_admin(auth.uid()));
CREATE POLICY leden_beheren ON public.partner_leden FOR ALL TO authenticated
  USING (public.partner_mag(partner_id, 'team.beheren') OR public.is_admin(auth.uid()))
  WITH CHECK (public.partner_mag(partner_id, 'team.beheren') OR public.is_admin(auth.uid()));

CREATE POLICY aanvragen_indienen ON public.partner_aanvragen FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'nieuw');
CREATE POLICY aanvragen_lezen ON public.partner_aanvragen FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY producten_lezen ON public.partner_producten FOR SELECT TO authenticated
  USING (public.partner_rol(partner_id) IS NOT NULL OR public.is_admin(auth.uid()));
CREATE POLICY producten_bewerken ON public.partner_producten FOR ALL TO authenticated
  USING (public.partner_mag(partner_id, 'producten.bewerken'))
  WITH CHECK (public.partner_mag(partner_id, 'producten.bewerken'));

-- Lopende campagnes en hun items zijn leesbaar voor de ene gesponsorde plek in Ontdek.
CREATE POLICY campagnes_lezen ON public.campagnes FOR SELECT TO authenticated
  USING (public.partner_rol(partner_id) IS NOT NULL OR public.campagne_loopt(id) OR public.is_admin(auth.uid()));
CREATE POLICY campagnes_aanmaken ON public.campagnes FOR INSERT TO authenticated
  WITH CHECK (public.partner_mag(partner_id, 'campagnes.bewerken'));
CREATE POLICY campagnes_bewerken ON public.campagnes FOR UPDATE TO authenticated
  USING (public.partner_mag(partner_id, 'campagnes.bewerken') OR public.is_admin(auth.uid()))
  WITH CHECK (public.partner_mag(partner_id, 'campagnes.bewerken') OR public.is_admin(auth.uid()));
CREATE POLICY campagnes_verwijderen ON public.campagnes FOR DELETE TO authenticated
  USING (public.partner_mag(partner_id, 'campagnes.bewerken') AND status = 'concept');

CREATE POLICY items_lezen ON public.gesponsorde_items FOR SELECT TO authenticated
  USING (public.partner_rol(public.campagne_partner(campagne_id)) IS NOT NULL
         OR public.campagne_loopt(campagne_id) OR public.is_admin(auth.uid()));
CREATE POLICY items_bewerken ON public.gesponsorde_items FOR ALL TO authenticated
  USING (public.partner_mag(public.campagne_partner(campagne_id), 'campagnes.bewerken')
         AND public.campagne_is_concept(campagne_id))
  WITH CHECK (public.partner_mag(public.campagne_partner(campagne_id), 'campagnes.bewerken')
              AND public.campagne_is_concept(campagne_id)
              AND (soort = 'product' OR public.is_openbaar_recept(recipe_id)));

CREATE POLICY samenwerkingen_lezen ON public.samenwerkingen FOR SELECT TO authenticated
  USING (public.partner_rol(partner_id) IS NOT NULL
         OR EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid())
         OR public.is_admin(auth.uid()));

CREATE POLICY statistiek_lezen ON public.gesponsord_statistiek FOR SELECT TO authenticated
  USING (public.partner_mag(public.campagne_partner(campagne_id), 'rapportage.zien')
         OR public.is_admin(auth.uid()));

COMMIT;
