-- Terugdraaien van 0003b. Gewiste rijen komen niet terug; alleen de functie en de planning verdwijnen.
SELECT cron.unschedule('foodlo-bewaartermijnen-inhoud');
DROP FUNCTION IF EXISTS public.ruim_inhoud_op();
