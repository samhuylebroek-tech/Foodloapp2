-- VOORSTEL — NIET UITGEVOERD. P2 Eén kostenbron: budgetgeschiedenis per week op het account.
--
-- budget_weken (één rij per gebruiker per week, maandag als sleutel):
-- - het weekbudget van die week (euro, 1–5000, of leeg) en de geschatte kost van het weekmenu
--   (schatting met Foodlo-richtprijzen, nooit een winkelprijs), plus hoeveel maaltijden niet
--   geschat konden worden (prijs onbekend telt nooit als € 0);
-- - alleen de eigen rijen zijn leesbaar en schrijfbaar (geen gezin, geen vrienden): een budget
--   is persoonlijk; geen gezondheidsgegevens;
-- - de app controleert eerst of de tabel bestaat (src/lib/module-beschikbaar.ts) en bewaart
--   anders op het toestel (laatste 12 weken), zoals vóór dit voorstel.
--
-- Lokaal getest met tests/rls/budget-weken.mjs (PGlite). Terugdraaien: 0014_…down.sql.

BEGIN;

CREATE TABLE public.budget_weken (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week date NOT NULL CHECK (extract(isodow FROM week) = 1),
  budget numeric(7,2) CHECK (budget IS NULL OR (budget > 0 AND budget <= 5000)),
  geschat numeric(8,2) NOT NULL CHECK (geschat >= 0 AND geschat <= 100000),
  niet_geschat smallint NOT NULL DEFAULT 0 CHECK (niet_geschat >= 0 AND niet_geschat <= 100),
  maaltijden smallint NOT NULL DEFAULT 0 CHECK (maaltijden >= 0 AND maaltijden <= 100),
  bijgewerkt_op timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week)
);

ALTER TABLE public.budget_weken ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.budget_weken FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_weken TO authenticated;

CREATE POLICY budget_weken_lezen ON public.budget_weken
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY budget_weken_maken ON public.budget_weken
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY budget_weken_wijzigen ON public.budget_weken
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY budget_weken_wissen ON public.budget_weken
  FOR DELETE TO authenticated USING (user_id = auth.uid());

COMMIT;
