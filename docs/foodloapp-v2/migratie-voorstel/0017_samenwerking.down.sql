-- Terugdraaien van 0017. Toewijzingen, meldingen in de app, het activiteitslog en de
-- meldingkeuzes gaan verloren; de app valt terug op dit toestel (verdelen, keuzes) of toont
-- die onderdelen niet. Weekmenu, lijsten en items blijven ongewijzigd.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.app_meldingen, public.lijst_toewijzingen;
    EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
    END;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.ruim_samenwerking_op();
DROP TABLE IF EXISTS public.app_melding_instellingen;
DROP TABLE IF EXISTS public.gezin_activiteit;
DROP TABLE IF EXISTS public.app_meldingen;
DROP TABLE IF EXISTS public.lijst_toewijzingen;
DROP FUNCTION IF EXISTS public.lijst_toewijzing_geldig();
DROP FUNCTION IF EXISTS public.samenwerking_mag_lijst_zien(uuid);
DROP FUNCTION IF EXISTS public.samenwerking_mag_lijst_bewerken(uuid);
DROP FUNCTION IF EXISTS public.samenwerking_is_lid(uuid);
COMMIT;
