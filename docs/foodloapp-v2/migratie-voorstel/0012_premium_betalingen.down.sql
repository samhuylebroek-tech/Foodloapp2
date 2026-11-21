-- Terugdraaien van 0012. Testabonnementen, testfacturen, rechten en betaal_events gaan verloren.
-- Gratis functies hangen hier niet van af: de app valt terug op "gratis".
BEGIN;
DROP TABLE IF EXISTS public.betaal_events;
DROP TABLE IF EXISTS public.entitlements;
DROP TABLE IF EXISTS public.facturen;
DROP TABLE IF EXISTS public.abonnementen;
COMMIT;
