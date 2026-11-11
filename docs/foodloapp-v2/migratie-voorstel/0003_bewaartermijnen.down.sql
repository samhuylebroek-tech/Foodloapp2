-- Terugdraaien van 0003_bewaartermijnen.up.sql. Al gewiste of gepseudonimiseerde rijen komen
-- NIET terug (dat is het doel van de opruiming); alleen de functie en de planning verdwijnen.
SELECT cron.unschedule('foodlo-bewaartermijnen');
DROP FUNCTION IF EXISTS public.ruim_telemetrie_op();
