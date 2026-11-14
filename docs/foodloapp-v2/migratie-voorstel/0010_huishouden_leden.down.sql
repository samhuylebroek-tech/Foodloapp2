-- Terugdraaien van 0010. Gezinsleden zonder account, hun voorkeuren en de mee-eters per maaltijd
-- gaan verloren (dat is de bedoeling); gezinnen, weekmenu en lijsten blijven ongewijzigd.
BEGIN;
DROP FUNCTION IF EXISTS public.maaltijd_veilig_voor(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.foodlo_bevat(text[], text);
DROP FUNCTION IF EXISTS public.foodlo_norm(text);
DROP TABLE IF EXISTS public.maaltijd_eters;
DROP TABLE IF EXISTS public.lid_voeding;
DROP TABLE IF EXISTS public.allergeen_woorden;
DROP TABLE IF EXISTS public.huishouden_leden;
DROP FUNCTION IF EXISTS public.lid_in_mijn_gezin(uuid);
DROP FUNCTION IF EXISTS public.mag_lid_beheren(uuid);
DROP FUNCTION IF EXISTS public.is_actief_gezinslid(uuid);
COMMIT;
