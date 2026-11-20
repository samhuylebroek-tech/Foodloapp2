-- VOORSTEL — NIET UITGEVOERD. Fase 6: premium en abonnementsbeheer in TESTMODUS.
-- Vereist 0011 (partners), 0012 (abonnementen, facturen, entitlements, betaal_events) en
-- 0022 (facturen.campagne_id). Regels:
-- - `plannen`: centrale catalogus van plannen en hun rechten (zoals src/lib/betalen/rechten.ts en
--   prijzen.ts). Iedereen die aangemeld is mag lezen; alleen de server (service-rol) schrijft.
--   modus is verplicht 'test' (CHECK): een echt plan kan pas na gate G5 via een aparte migratie.
-- - abonnementen: jaarplan, genadeperiode na een mislukte betaling (genade_tot) en een geplande
--   overstap naar maandelijks (gepland_plan).
-- - facturen: btw apart (btw_cent ≤ bedrag_cent, btw_procent 0–30), creditnota's voor een
--   terugbetaling binnen de herroepingstermijn (verwijst_naar verplicht, hoogstens één creditnota
--   per factuur). Nog steeds alleen testfacturen (CHECK test uit 0012).
-- - entitlements: blijven ALLEEN door de server te schrijven (geen INSERT/UPDATE/DELETE-policy,
--   geen schrijfrecht voor authenticated); een recht staat hoogstens één keer per bron.
-- - gebruiker ziet alleen eigen facturen (RLS facturen_lezen uit 0012 blijft ongewijzigd).
-- Lokaal getest met tests/rls/premium-beheer.mjs (PGlite). Terugdraaien: 0023_…down.sql.

BEGIN;

-- ---------- plannen (catalogus, alleen lezen) ----------
CREATE TABLE public.plannen (
  id text PRIMARY KEY CHECK (id ~ '^[a-z_]+$'),
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 2 AND 60),
  voor text NOT NULL CHECK (voor IN ('consument', 'partner')),
  interval text NOT NULL CHECK (interval IN ('maand', 'jaar')),
  prijs_cent integer NOT NULL CHECK (prijs_cent BETWEEN 0 AND 100000),
  btw_procent numeric(4, 1) NOT NULL DEFAULT 21 CHECK (btw_procent BETWEEN 0 AND 30),
  proef_dagen integer NOT NULL DEFAULT 0 CHECK (proef_dagen BETWEEN 0 AND 60),
  rechten text[] NOT NULL DEFAULT '{}',
  modus text NOT NULL DEFAULT 'test' CHECK (modus = 'test'),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.plannen (id, naam, voor, interval, prijs_cent, proef_dagen, rechten) VALUES
  ('premium_maand', 'Foodlo Premium', 'consument', 'maand', 499, 14,
    ARRAY['premium.weekmenu_extra', 'premium.seizoenskalender']),
  ('premium_jaar', 'Foodlo Premium (jaar)', 'consument', 'jaar', 4990, 14,
    ARRAY['premium.weekmenu_extra', 'premium.seizoenskalender']),
  ('partner_basis', 'Partner Basis', 'partner', 'maand', 0, 0, ARRAY['partner.producten']),
  ('partner_plus', 'Partner Plus', 'partner', 'maand', 4900, 0,
    ARRAY['partner.producten', 'partner.campagnes', 'partner.rapportage_export']);

REVOKE ALL ON public.plannen FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plannen TO authenticated;
GRANT ALL ON public.plannen TO service_role;
ALTER TABLE public.plannen ENABLE ROW LEVEL SECURITY;
CREATE POLICY plannen_lezen ON public.plannen FOR SELECT TO authenticated USING (true);

-- ---------- abonnementen: jaarplan, genade, geplande overstap ----------
ALTER TABLE public.abonnementen DROP CONSTRAINT abonnementen_plan_check;
ALTER TABLE public.abonnementen
  ADD CONSTRAINT abonnementen_plan_check
    CHECK (plan IN ('premium_maand', 'premium_jaar', 'partner_basis', 'partner_plus')),
  ADD COLUMN genade_tot date,
  ADD COLUMN gepland_plan text
    CHECK (gepland_plan IS NULL OR gepland_plan IN ('premium_maand', 'premium_jaar')),
  ADD CONSTRAINT abonnementen_genade_alleen_bij_mislukt
    CHECK (genade_tot IS NULL OR status = 'betaling_mislukt');

-- ---------- facturen: btw apart en creditnota's ----------
ALTER TABLE public.facturen
  ADD COLUMN soort text NOT NULL DEFAULT 'factuur' CHECK (soort IN ('factuur', 'creditnota')),
  ADD COLUMN btw_cent integer NOT NULL DEFAULT 0 CHECK (btw_cent >= 0),
  ADD COLUMN btw_procent numeric(4, 1) NOT NULL DEFAULT 21 CHECK (btw_procent BETWEEN 0 AND 30),
  ADD COLUMN verwijst_naar uuid REFERENCES public.facturen(id) ON DELETE RESTRICT,
  ADD CONSTRAINT facturen_btw_max CHECK (btw_cent <= bedrag_cent),
  ADD CONSTRAINT facturen_creditnota_verwijst
    CHECK ((soort = 'creditnota') = (verwijst_naar IS NOT NULL));
CREATE UNIQUE INDEX facturen_een_creditnota ON public.facturen (verwijst_naar)
  WHERE soort = 'creditnota';

-- ---------- entitlements: één keer per recht en bron ----------
CREATE UNIQUE INDEX entitlements_uniek_gebruiker ON public.entitlements (user_id, recht, bron)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX entitlements_uniek_partner ON public.entitlements (partner_id, recht, bron)
  WHERE partner_id IS NOT NULL;
-- Opnieuw expliciet (verdediging in de diepte): de app kan rechten, abonnementen en facturen
-- nooit zelf schrijven; dat doet alleen de server na een gecontroleerde (test)webhook.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.entitlements, public.abonnementen, public.facturen
  FROM anon, authenticated;

COMMIT;
