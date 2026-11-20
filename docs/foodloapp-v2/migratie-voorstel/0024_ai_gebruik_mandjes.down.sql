-- Terugdraaien van 0024. Het AI-gebruik op het account, en de testmandjes (de bestaande servercache ai_cache blijft) gaan
-- verloren; de app houdt het gebruik dan weer alleen op het toestel bij (niets breekt).
BEGIN;
DROP FUNCTION IF EXISTS public.ai_gebruik_tel(text, boolean);
DROP FUNCTION IF EXISTS public.ruim_ai_op();
DROP TABLE IF EXISTS public.winkel_mandjes;
DROP TABLE IF EXISTS public.ai_gebruik_totaal;
DROP TABLE IF EXISTS public.ai_gebruik_dag;
COMMIT;
