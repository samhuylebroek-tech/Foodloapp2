-- VOORSTEL — NIET UITGEVOERD. Fase 3: waar staat iets in je voorraad (koelkast, diepvries, kast).
-- Eén optionele kolom; leeg = Foodlo gokt op basis van de naam (src/lib/voorraad-plek.ts).
-- Rechten veranderen niet: dezelfde policies als pantry_items (eigen rijen schrijven; actieve
-- gezinsleden lezen mee, BUG-112). Geen gezondheidsgegeven.
-- Zolang de kolom ontbreekt, bewaart de app de plek op het toestel.
-- Lokaal getest met tests/rls/voorraad-plek.mjs (PGlite). Terugdraaien: 0020_…down.sql.

BEGIN;

ALTER TABLE public.pantry_items
  ADD COLUMN plek text CHECK (plek IS NULL OR plek IN ('koelkast', 'diepvries', 'kast'));

COMMIT;
