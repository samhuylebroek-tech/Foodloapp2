-- Terugdraaien van 0009. De accountkopie van allergieën en voorkeuren gaat verloren (dat is de
-- bedoeling); wat op de toestellen staat (localStorage) blijft, en de app valt daarop terug.
BEGIN;
DROP TABLE IF EXISTS public.persoonlijke_voeding;
COMMIT;
