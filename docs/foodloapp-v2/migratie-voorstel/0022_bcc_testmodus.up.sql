-- VOORSTEL — NIET UITGEVOERD. Fase 5: Business Control Center in TESTMODUS.
-- Vereist 0008 (creators), 0011 (partners, campagnes), 0012 (facturen) en 0021 (maker_betalingen).
-- Regels:
-- - partneraanvragen krijgen een beoordeling (reden, wie, wanneer, aangemaakte partner); alleen de
--   server (service-rol, na bewaker() in bcc.functions.ts) beslist. Afwijzen vraagt een reden;
-- - campagnes krijgen een testbudget (in eurocent). Een partner kan het alleen in een concept
--   zetten (bestaande trigger bewaak_campagne: na indienen niets meer wijzigen);
-- - facturen kunnen naar een campagne verwijzen (testfactuur bij een goedgekeurd testbudget);
-- - beheer_uitnodigingen: teamuitnodigingen zonder e-mail (status 'testmodus' of 'ingetrokken'),
--   nooit de rol eigenaar (super_admin); alleen de server leest en schrijft;
-- - maker_uitbetalingen: wat er per maker per maand ZOU uitbetaald worden. Status, KYC en test zijn
--   met CHECK vastgezet ('zou_uitbetaald_worden', 'niet_gekoppeld', true): een echte uitbetaling
--   kan pas via een aparte migratie na gate G5 (juridisch, btw, KYC-provider). De maker leest
--   alleen de eigen rijen;
-- - auditlog: bestond al onwijzigbaar (trigger op UPDATE/DELETE). Nu ook TRUNCATE geblokkeerd en
--   geen enkel schrijfrecht voor anon/authenticated: alleen-invoegen, door de server;
-- - één standaardinstelling: maker_platform_procent = 15 (centraal instelbaar door de eigenaar).
-- Lokaal getest met tests/rls/bcc-testmodus.mjs (PGlite). Terugdraaien: 0022_bcc_testmodus.down.sql.

BEGIN;

-- ---------- partneraanvragen: beoordeling ----------
ALTER TABLE public.partner_aanvragen
  ADD COLUMN beoordeling_reden text CHECK (beoordeling_reden IS NULL OR char_length(beoordeling_reden) <= 500),
  ADD COLUMN beoordeeld_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN beoordeeld_op timestamptz,
  ADD COLUMN partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD CONSTRAINT partner_aanvragen_reden_bij_weigeren
    CHECK (status <> 'geweigerd' OR char_length(coalesce(beoordeling_reden, '')) >= 3);

-- ---------- campagnes: testbudget ----------
ALTER TABLE public.campagnes
  ADD COLUMN testbudget_cent integer NOT NULL DEFAULT 0
    CHECK (testbudget_cent BETWEEN 0 AND 10000000);

-- ---------- facturen: koppeling met een campagne ----------
ALTER TABLE public.facturen
  ADD COLUMN campagne_id uuid REFERENCES public.campagnes(id) ON DELETE SET NULL;

-- ---------- teamuitnodigingen (testmodus) ----------
CREATE TABLE public.beheer_uitnodigingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) <= 200 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  rol public.admin_role NOT NULL CHECK (rol <> 'super_admin'),
  status text NOT NULL DEFAULT 'testmodus' CHECK (status IN ('testmodus', 'ingetrokken')),
  test boolean NOT NULL DEFAULT true CHECK (test),
  uitgenodigd_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  verloopt_op timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE UNIQUE INDEX beheer_uitnodigingen_open_uniek
  ON public.beheer_uitnodigingen (lower(email)) WHERE status = 'testmodus';

-- ---------- makeruitbetalingen (testmodus) ----------
CREATE TABLE public.maker_uitbetalingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.creators(id) ON DELETE SET NULL,
  maand date NOT NULL CHECK (extract(day FROM maand) = 1),
  bruto_cent integer NOT NULL CHECK (bruto_cent >= 0),
  btw_cent integer NOT NULL CHECK (btw_cent >= 0),
  betaalkosten_cent integer NOT NULL CHECK (betaalkosten_cent >= 0),
  platform_cent integer NOT NULL CHECK (platform_cent >= 0),
  maker_cent integer NOT NULL CHECK (maker_cent >= 0),
  platform_procent numeric(4, 1) NOT NULL CHECK (platform_procent BETWEEN 0 AND 50),
  status text NOT NULL DEFAULT 'zou_uitbetaald_worden' CHECK (status = 'zou_uitbetaald_worden'),
  kyc text NOT NULL DEFAULT 'niet_gekoppeld' CHECK (kyc = 'niet_gekoppeld'),
  test boolean NOT NULL DEFAULT true CHECK (test),
  vastgelegd_door uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, maand),
  CHECK (btw_cent + betaalkosten_cent + platform_cent + maker_cent = bruto_cent)
);

REVOKE ALL ON public.beheer_uitnodigingen, public.maker_uitbetalingen FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.maker_uitbetalingen TO authenticated;
GRANT ALL ON public.beheer_uitnodigingen, public.maker_uitbetalingen TO service_role;
ALTER TABLE public.beheer_uitnodigingen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maker_uitbetalingen ENABLE ROW LEVEL SECURITY;
-- Bewust geen policy op beheer_uitnodigingen: alleen de server (service-rol) leest en schrijft.
CREATE POLICY maker_uitbetalingen_eigen ON public.maker_uitbetalingen FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid()));

-- ---------- auditlog: alleen invoegen ----------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.block_audit_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Auditlogboek is onveranderlijk';
END; $$;
CREATE TRIGGER admin_audit_log_geen_truncate
  BEFORE TRUNCATE ON public.admin_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_audit_truncate();

-- ---------- centrale verdeling maker/platform ----------
INSERT INTO public.platform_settings (key, value, description)
VALUES ('maker_platform_procent', '15'::jsonb,
        'Platformdeel van makerabonnementen in procent (testmodus).')
ON CONFLICT (key) DO NOTHING;

COMMIT;
