-- VOORSTEL — NIET UITGEVOERD. Werkstroom E: premium, abonnementen, testfacturen, entitlements
-- en betaal_events (MODULE_DESIGNS §11, COMMERCIAL_ROADMAP §1 en §4). Vereist 0011 (partners).
-- Regels:
-- - schrijven gebeurt ALLEEN door de server (service-rol) na een gecontroleerde webhook; een
--   gebruiker kan zijn eigen abonnement, facturen en rechten enkel lezen;
-- - partnerabonnementen: elk lid leest het plan, facturen alleen met recht abonnement.beheren;
-- - betaal_events: unieke event_id (dubbel ontvangen webhook = één keer verwerkt), alleen beheer
--   leest ze; nooit kaartgegevens (die blijven bij de PCI-conforme provider);
-- - modus is vandaag verplicht 'test' (CHECK). 'live' kan pas via een aparte migratie na gate G5
--   (juridische, btw- en veiligheidsreview) en BETAALPROVIDER_GEKOPPELD = true.
-- Lokaal getest met tests/rls/partners-premium.mjs (PGlite). Terugdraaien: 0012_…down.sql.

BEGIN;

CREATE TABLE public.abonnementen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('premium_maand', 'partner_basis', 'partner_plus')),
  status text NOT NULL CHECK (status IN ('geen', 'proef', 'actief', 'opgezegd', 'betaling_mislukt')),
  modus text NOT NULL DEFAULT 'test' CHECK (modus = 'test'),
  provider text NOT NULL DEFAULT 'test',
  provider_ref text NOT NULL,
  periode_einde date,
  opgezegd_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (partner_id IS NULL)),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX abonnementen_user_idx ON public.abonnementen (user_id);
CREATE INDEX abonnementen_partner_idx ON public.abonnementen (partner_id);

CREATE TABLE public.facturen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  abonnement_id uuid REFERENCES public.abonnementen(id) ON DELETE SET NULL,
  nummer text NOT NULL UNIQUE,
  omschrijving text NOT NULL,
  bedrag_cent integer NOT NULL CHECK (bedrag_cent >= 0),
  status text NOT NULL CHECK (status IN ('betaald', 'open', 'mislukt')),
  test boolean NOT NULL DEFAULT true CHECK (test),
  datum date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  recht text NOT NULL CHECK (recht ~ '^[a-z]+\.[a-z_]+$'),
  bron text NOT NULL DEFAULT 'abonnement' CHECK (bron IN ('abonnement', 'team', 'actie')),
  geldig_tot date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (partner_id IS NULL))
);
CREATE INDEX entitlements_user_idx ON public.entitlements (user_id, recht);

CREATE TABLE public.betaal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  provider text NOT NULL,
  soort text NOT NULL,
  abonnement_ref text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  verwerkt boolean NOT NULL DEFAULT false,
  reden text,
  ontvangen_op timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Idempotentie: één gebeurtenis van een provider wordt één keer opgeslagen en verwerkt.
CREATE UNIQUE INDEX betaal_events_uniek ON public.betaal_events (provider, event_id);

REVOKE ALL ON public.abonnementen, public.facturen, public.entitlements, public.betaal_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.abonnementen, public.facturen, public.entitlements, public.betaal_events
  TO authenticated;
GRANT ALL ON public.abonnementen, public.facturen, public.entitlements, public.betaal_events
  TO service_role;

ALTER TABLE public.abonnementen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betaal_events ENABLE ROW LEVEL SECURITY;

-- Alleen lezen; er zijn bewust geen INSERT/UPDATE/DELETE-policies voor authenticated.
CREATE POLICY abonnementen_lezen ON public.abonnementen FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (partner_id IS NOT NULL AND public.partner_rol(partner_id) IS NOT NULL)
         OR public.is_admin(auth.uid()));
CREATE POLICY facturen_lezen ON public.facturen FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (partner_id IS NOT NULL AND public.partner_mag(partner_id, 'abonnement.beheren'))
         OR public.is_admin(auth.uid()));
CREATE POLICY entitlements_lezen ON public.entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (partner_id IS NOT NULL AND public.partner_rol(partner_id) IS NOT NULL));
CREATE POLICY betaal_events_beheer ON public.betaal_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

COMMIT;
