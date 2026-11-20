-- VOORSTEL — NIET UITGEVOERD. Fase 4: makerabonnementen in TESTMODUS, exclusieve recepten en
-- collecties, community (reacties, "Ik heb het gemaakt" met foto, blokkeren) en meldingen van
-- inhoud. Vereist 0008 (makers en community). 0017 (meldingen in de app) is optioneel: is die
-- er, dan krijgt de lijst met uit te zetten soorten er "maker" bij.
-- Regels:
-- - abonnementen en (test)betalingen schrijft ALLEEN de server (service-rol), na
--   testBetalingGeweigerd(); modus is verplicht 'test' en een betaling is verplicht test = true.
--   'live' kan pas via een aparte migratie na gate G5 (juridisch, btw, veiligheid, provider);
-- - een fan leest zijn eigen abonnement en testbetalingen; de maker ziet zijn abonnees alleen
--   via maker_abonnees() (voornaam, sinds, status) en NOOIT de betalingen;
-- - exclusief recept of collectie: de inhoud is alleen leesbaar voor de maker en voor wie een
--   actief abonnement heeft (heeft_maker_recht). Een aankondiging (titel, foto) kan via
--   exclusieve_aankondigingen();
-- - community: reactie zonder sterren of "gemaakt" met 1–5 sterren; foto alleen een pad in de
--   eigen map van de privé-bucket community-fotos; bijdragen van wie je blokkeerde zie je niet;
-- - meldingen: één open melding per persoon per inhoud; drie verschillende melders verbergen
--   een bijdrage tot het Foodlo-team beslist.
-- Lokaal getest met tests/rls/makers-abonnement.mjs (PGlite). Terugdraaien: 0021_…down.sql.

BEGIN;

-- ---------- exclusiviteit ----------
ALTER TABLE public.recipe_publicaties ADD COLUMN exclusief boolean NOT NULL DEFAULT false;
ALTER TABLE public.collections ADD COLUMN exclusief boolean NOT NULL DEFAULT false;

-- ---------- plan van de maker (testprijs en voordelen) ----------
CREATE TABLE public.maker_plannen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL UNIQUE REFERENCES public.creators(id) ON DELETE CASCADE,
  prijs_cent integer NOT NULL CHECK (prijs_cent BETWEEN 100 AND 5000),
  voordelen text[] NOT NULL CHECK (cardinality(voordelen) BETWEEN 1 AND 5),
  actief boolean NOT NULL DEFAULT false,
  modus text NOT NULL DEFAULT 'test' CHECK (modus = 'test'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- abonnementen (alleen de server schrijft) ----------
CREATE TABLE public.maker_abonnementen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('actief', 'opgezegd')),
  modus text NOT NULL DEFAULT 'test' CHECK (modus = 'test'),
  prijs_cent integer NOT NULL CHECK (prijs_cent BETWEEN 100 AND 5000),
  start_op timestamptz NOT NULL DEFAULT now(),
  periode_einde timestamptz NOT NULL,
  opgezegd_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fan_id, creator_id)
);
CREATE INDEX maker_abonnementen_creator_idx ON public.maker_abonnementen (creator_id, status);

-- Testbetalingen en -terugbetalingen. Geen kaartgegevens: die blijven bij een (latere)
-- PCI-conforme provider. Bij verwijderen van een account blijft de boekhoudregel (SET NULL).
CREATE TABLE public.maker_betalingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abonnement_id uuid REFERENCES public.maker_abonnementen(id) ON DELETE SET NULL,
  fan_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_id uuid REFERENCES public.creators(id) ON DELETE SET NULL,
  soort text NOT NULL CHECK (soort IN ('betaling', 'terugbetaling')),
  bedrag_cent integer NOT NULL CHECK (bedrag_cent >= 0),
  btw_cent integer NOT NULL CHECK (btw_cent >= 0),
  platform_cent integer NOT NULL DEFAULT 0 CHECK (platform_cent >= 0),
  maker_cent integer NOT NULL DEFAULT 0 CHECK (maker_cent >= 0),
  provider text NOT NULL DEFAULT 'test',
  provider_ref text NOT NULL,
  test boolean NOT NULL DEFAULT true CHECK (test),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX maker_betalingen_fan_idx ON public.maker_betalingen (fan_id, created_at DESC);

-- ---------- blokkeren (privé) ----------
CREATE TABLE public.gebruiker_blokkades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blokkeerder_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  geblokkeerd_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weergavenaam text CHECK (weergavenaam IS NULL OR char_length(weergavenaam) <= 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blokkeerder_id, geblokkeerd_id),
  CHECK (blokkeerder_id <> geblokkeerd_id)
);

-- ---------- community: reacties en foto's ----------
ALTER TABLE public.community_bijdragen
  ADD COLUMN soort text NOT NULL DEFAULT 'gemaakt' CHECK (soort IN ('gemaakt', 'reactie'));
ALTER TABLE public.community_bijdragen DROP CONSTRAINT IF EXISTS community_bijdragen_sterren_check;
ALTER TABLE public.community_bijdragen ALTER COLUMN sterren DROP NOT NULL;
ALTER TABLE public.community_bijdragen ADD CONSTRAINT community_bijdragen_sterren_soort CHECK (
  -- Let op NULL: "sterren BETWEEN 1 AND 5" alleen zou een lege score laten passeren.
  (soort = 'gemaakt' AND sterren IS NOT NULL AND sterren BETWEEN 1 AND 5)
  OR (soort = 'reactie' AND sterren IS NULL)
);
ALTER TABLE public.community_bijdragen ADD CONSTRAINT community_bijdragen_foto_eigen CHECK (
  foto_url IS NULL OR (
    soort = 'gemaakt'
    AND foto_url ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    AND split_part(foto_url, '/', 1) = user_id::text
  )
);

-- ---------- meldingen van inhoud ----------
-- Eén open melding per persoon per inhoud (geen spam met tien keer dezelfde melding).
CREATE UNIQUE INDEX content_meldingen_een_open ON public.content_meldingen (melder_id, soort, doel_id)
  WHERE status = 'open';

-- ---------- hulpfuncties ----------
-- Actief abonnement (of de maker zelf). SECURITY DEFINER: de fan mag de tabel van de maker niet
-- lezen, en zo ontstaat geen recursie tussen policies.
CREATE OR REPLACE FUNCTION public.heeft_maker_recht(_creator uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.creators c WHERE c.id = _creator AND c.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.maker_abonnementen a
       WHERE a.creator_id = _creator AND a.fan_id = auth.uid()
         AND a.status = 'actief' AND a.periode_einde >= now()
    )
  );
$$;
REVOKE ALL ON FUNCTION public.heeft_maker_recht(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heeft_maker_recht(uuid) TO authenticated, service_role;

-- Zelfde, op basis van de gebruiker achter een makerpagina (voor verzamelingen).
CREATE OR REPLACE FUNCTION public.heeft_maker_recht_van(_maker_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _maker_user = auth.uid() OR EXISTS (
    SELECT 1 FROM public.creators c WHERE c.user_id = _maker_user AND public.heeft_maker_recht(c.id)
  );
$$;
REVOKE ALL ON FUNCTION public.heeft_maker_recht_van(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heeft_maker_recht_van(uuid) TO authenticated, service_role;

-- Openbaar = openbaar + gepubliceerd + goedgekeurd + niet verwijderd, en bij exclusief: recht.
-- Vervangt de versie uit 0008; de policies van recipes, recipe_ingredients en
-- community_bijdragen gebruiken deze functie en volgen dus vanzelf.
CREATE OR REPLACE FUNCTION public.is_openbaar_recept(_recipe uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipe_publicaties p JOIN public.recipes r ON r.id = p.recipe_id
     WHERE p.recipe_id = _recipe AND p.zichtbaarheid = 'openbaar' AND p.status = 'gepubliceerd'
       AND p.moderatie = 'goedgekeurd' AND r.deleted_at IS NULL
       AND (NOT p.exclusief OR public.heeft_maker_recht(p.creator_id))
  );
$$;

-- Aankondiging van exclusieve recepten: titel en foto, nooit ingrediënten of stappen.
CREATE OR REPLACE FUNCTION public.exclusieve_aankondigingen(p_creator uuid)
RETURNS TABLE (recipe_id uuid, title text, image_url text, gepubliceerd_op timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.title, r.image_url, p.gepubliceerd_op
    FROM public.recipe_publicaties p JOIN public.recipes r ON r.id = p.recipe_id
   WHERE auth.uid() IS NOT NULL AND p.creator_id = p_creator AND p.exclusief
     AND p.zichtbaarheid = 'openbaar' AND p.status = 'gepubliceerd'
     AND p.moderatie = 'goedgekeurd' AND r.deleted_at IS NULL
   ORDER BY p.gepubliceerd_op DESC
   LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.exclusieve_aankondigingen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exclusieve_aankondigingen(uuid) TO authenticated, service_role;

-- De maker ziet zijn abonnees: voornaam, sinds, status. Geen e-mail, geen bedragen.
CREATE OR REPLACE FUNCTION public.maker_abonnees(p_creator uuid)
RETURNS TABLE (voornaam text, sinds timestamptz, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(split_part(btrim(coalesce(pr.display_name, '')), ' ', 1), ''), 'Een fan'),
         a.start_op,
         CASE WHEN a.status = 'actief' AND a.periode_einde >= now() THEN 'actief' ELSE 'opgezegd' END
    FROM public.maker_abonnementen a
    JOIN public.creators c ON c.id = a.creator_id
    LEFT JOIN public.profiles pr ON pr.id = a.fan_id
   WHERE a.creator_id = p_creator AND c.user_id = auth.uid()
   ORDER BY a.start_op DESC
   LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.maker_abonnees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maker_abonnees(uuid) TO authenticated, service_role;

-- Drie verschillende melders → bijdrage verborgen tot het Foodlo-team beslist.
CREATE OR REPLACE FUNCTION public.verberg_na_meldingen()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.soort = 'bijdrage' AND (
    SELECT count(DISTINCT melder_id) FROM public.content_meldingen
     WHERE soort = 'bijdrage' AND doel_id = NEW.doel_id AND status = 'open'
  ) >= 3 THEN
    UPDATE public.community_bijdragen SET verborgen = true WHERE id = NEW.doel_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER content_meldingen_verberg AFTER INSERT ON public.content_meldingen
  FOR EACH ROW EXECUTE FUNCTION public.verberg_na_meldingen();

-- ---------- rechten ----------
REVOKE ALL ON public.maker_plannen, public.maker_abonnementen, public.maker_betalingen,
  public.gebruiker_blokkades FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maker_plannen TO authenticated;
GRANT SELECT ON public.maker_abonnementen, public.maker_betalingen TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.gebruiker_blokkades TO authenticated;
GRANT ALL ON public.maker_plannen, public.maker_abonnementen, public.maker_betalingen,
  public.gebruiker_blokkades TO service_role;

ALTER TABLE public.maker_plannen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maker_abonnementen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maker_betalingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gebruiker_blokkades ENABLE ROW LEVEL SECURITY;

-- plan: iedereen (ingelogd) ziet een actief plan; de maker beheert het eigen plan.
CREATE POLICY maker_plannen_lezen ON public.maker_plannen FOR SELECT TO authenticated
  USING (actief OR EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid()));
CREATE POLICY maker_plannen_eigen ON public.maker_plannen FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid()));

-- abonnementen en betalingen: alleen de fan zelf en beheer lezen; niemand schrijft (behalve
-- de server). De maker gebruikt maker_abonnees().
CREATE POLICY maker_abonnementen_lezen ON public.maker_abonnementen FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY maker_betalingen_lezen ON public.maker_betalingen FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR public.is_admin(auth.uid()));

-- blokkades: alleen de eigen lijst.
CREATE POLICY blokkades_eigen ON public.gebruiker_blokkades FOR ALL TO authenticated
  USING (blokkeerder_id = auth.uid()) WITH CHECK (blokkeerder_id = auth.uid());

-- verzamelingen: een exclusieve, openbare verzameling alleen met recht.
DROP POLICY collections_lezen ON public.collections;
CREATE POLICY collections_lezen ON public.collections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (openbaar AND (NOT exclusief OR public.heeft_maker_recht_van(user_id))));
DROP POLICY collection_recipes_lezen ON public.collection_recipes;
CREATE POLICY collection_recipes_lezen ON public.collection_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                 AND (c.user_id = auth.uid()
                      OR (c.openbaar AND (NOT c.exclusief OR public.heeft_maker_recht_van(c.user_id))))));

-- community: bijdragen van wie jij blokkeerde, zie je niet.
DROP POLICY bijdragen_lezen ON public.community_bijdragen;
CREATE POLICY bijdragen_lezen ON public.community_bijdragen FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (
    NOT verborgen AND public.is_openbaar_recept(recipe_id)
    AND NOT EXISTS (SELECT 1 FROM public.gebruiker_blokkades g
                     WHERE g.blokkeerder_id = auth.uid() AND g.geblokkeerd_id = user_id)
  ));

-- ---------- opslag: privé-bucket voor foto's bij "Ik heb het gemaakt" ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-fotos', 'community-fotos', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY community_fotos_schrijven ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY community_fotos_wissen ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);
-- Lezen: je eigen foto's, en foto's bij een bijdrage die jij mag zien (RLS hierboven geldt).
CREATE POLICY community_fotos_lezen ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-fotos' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.community_bijdragen b WHERE b.foto_url = objects.name)
  ));

-- ---------- meldingen in de app (0017): soort "maker" mag uit ----------
DO $$
BEGIN
  IF to_regclass('public.app_melding_instellingen') IS NOT NULL THEN
    ALTER TABLE public.app_melding_instellingen DROP CONSTRAINT IF EXISTS app_melding_instellingen_uit_check;
    ALTER TABLE public.app_melding_instellingen ADD CONSTRAINT app_melding_instellingen_uit_check CHECK (
      uit <@ ARRAY['menu','toegewezen','winkelen-klaar','restje','conflict','maker']::text[]
    );
  END IF;
END $$;

COMMIT;
