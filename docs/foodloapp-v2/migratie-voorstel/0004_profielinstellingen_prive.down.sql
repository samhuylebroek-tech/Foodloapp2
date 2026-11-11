-- Terugdraaien van voorstel 0004: exact de huidige stand (kolom leesbaar, geen functie).
BEGIN;
GRANT SELECT (weekmenu) ON public.profiles TO authenticated;
DROP FUNCTION IF EXISTS public.eigen_weekmenu();
COMMIT;
