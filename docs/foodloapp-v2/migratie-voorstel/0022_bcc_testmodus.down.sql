-- Terugdraaien van 0022. Teamuitnodigingen en testuitbetalingen gaan verloren (alleen testmodus);
-- de beoordeling van partneraanvragen, het testbudget en de campagnekoppeling van facturen ook.
-- Het auditlog zelf blijft onaangeroerd: de extra TRUNCATE-blokkade gaat weg, de ingetrokken
-- schrijfrechten voor anon/authenticated blijven bewust ingetrokken (veiliger, RLS liet al niets toe).
BEGIN;
DELETE FROM public.platform_settings WHERE key = 'maker_platform_procent';
DROP TRIGGER IF EXISTS admin_audit_log_geen_truncate ON public.admin_audit_log;
DROP FUNCTION IF EXISTS public.block_audit_truncate();
DROP TABLE IF EXISTS public.maker_uitbetalingen;
DROP TABLE IF EXISTS public.beheer_uitnodigingen;
ALTER TABLE public.facturen DROP COLUMN IF EXISTS campagne_id;
ALTER TABLE public.campagnes DROP COLUMN IF EXISTS testbudget_cent;
ALTER TABLE public.partner_aanvragen
  DROP CONSTRAINT IF EXISTS partner_aanvragen_reden_bij_weigeren,
  DROP COLUMN IF EXISTS partner_id,
  DROP COLUMN IF EXISTS beoordeeld_op,
  DROP COLUMN IF EXISTS beoordeeld_door,
  DROP COLUMN IF EXISTS beoordeling_reden;
COMMIT;
