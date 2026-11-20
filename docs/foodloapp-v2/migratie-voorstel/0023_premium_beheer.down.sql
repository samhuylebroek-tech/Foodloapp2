-- Terugdraaien van 0023. De catalogus `plannen` verdwijnt (de app gebruikt dan rechten.ts en
-- prijzen.ts). Alleen testgegevens worden aangepast:
-- - jaarabonnementen (test) worden maandabonnementen, zodat de CHECK uit 0012 weer past;
-- - testcreditnota's krijgen "CREDITNOTA:" vooraan in de omschrijving, zodat ze herkenbaar blijven
--   nadat de kolom `soort` verdwijnt (niets wordt gewist).
BEGIN;
DROP INDEX IF EXISTS public.entitlements_uniek_gebruiker;
DROP INDEX IF EXISTS public.entitlements_uniek_partner;

UPDATE public.facturen SET omschrijving = 'CREDITNOTA: ' || omschrijving
  WHERE soort = 'creditnota' AND omschrijving NOT LIKE 'CREDITNOTA:%';
DROP INDEX IF EXISTS public.facturen_een_creditnota;
ALTER TABLE public.facturen
  DROP CONSTRAINT IF EXISTS facturen_creditnota_verwijst,
  DROP CONSTRAINT IF EXISTS facturen_btw_max,
  DROP COLUMN IF EXISTS verwijst_naar,
  DROP COLUMN IF EXISTS btw_procent,
  DROP COLUMN IF EXISTS btw_cent,
  DROP COLUMN IF EXISTS soort;

UPDATE public.abonnementen SET plan = 'premium_maand' WHERE plan = 'premium_jaar';
ALTER TABLE public.abonnementen
  DROP CONSTRAINT IF EXISTS abonnementen_genade_alleen_bij_mislukt,
  DROP COLUMN IF EXISTS gepland_plan,
  DROP COLUMN IF EXISTS genade_tot,
  DROP CONSTRAINT IF EXISTS abonnementen_plan_check;
ALTER TABLE public.abonnementen
  ADD CONSTRAINT abonnementen_plan_check
    CHECK (plan IN ('premium_maand', 'partner_basis', 'partner_plus'));

DROP TABLE IF EXISTS public.plannen;
COMMIT;
