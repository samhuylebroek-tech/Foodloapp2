-- Terugdraaien van 0006. De reacties zelf gaan verloren (dat is de bedoeling van terugdraaien).
SELECT cron.unschedule('foodlo-aanbeveling-feedback');
DROP FUNCTION IF EXISTS public.ruim_aanbeveling_feedback_op();
DROP TABLE IF EXISTS public.aanbeveling_feedback;
