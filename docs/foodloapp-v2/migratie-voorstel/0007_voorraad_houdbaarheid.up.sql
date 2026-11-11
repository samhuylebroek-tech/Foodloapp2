-- VOORSTEL — NIET UITGEVOERD. Foodloapp Intelligence I-3: houdbaarheid in de voorraad
-- (usecase 6 "Gebruik je spinazie", beslissing 17). Eén optionele datum per product; leeg = onbekend.
-- Rechten veranderen niet: dezelfde policies als pantry_items (eigen rijen schrijven; actieve
-- gezinsleden lezen mee, BUG-112). Een houdbaarheidsdatum is geen gezondheidsgegeven.
-- Lokaal getest met tests/rls/intelligentie-voorstellen.mjs (PGlite).

BEGIN;

ALTER TABLE public.pantry_items
  ADD COLUMN houdbaar_tot date
  CHECK (houdbaar_tot IS NULL OR houdbaar_tot BETWEEN date '2020-01-01' AND date '2100-12-31');

CREATE INDEX pantry_items_houdbaar_idx ON public.pantry_items (user_id, houdbaar_tot)
  WHERE houdbaar_tot IS NOT NULL;

COMMIT;
