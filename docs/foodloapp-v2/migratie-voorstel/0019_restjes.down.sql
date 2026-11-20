-- Terugdraaien van 0019. Restjes op het account gaan verloren; de app valt terug op het toestel
-- (de lijst op elk toestel blijft staan). Recepten, voorraad en weekmenu blijven.
BEGIN;
DROP TABLE IF EXISTS public.restjes;
DROP FUNCTION IF EXISTS public.restjes_vaste_velden();
DROP FUNCTION IF EXISTS public.restjes_is_lid(uuid);
DROP FUNCTION IF EXISTS public.ruim_restjes_op();
COMMIT;
