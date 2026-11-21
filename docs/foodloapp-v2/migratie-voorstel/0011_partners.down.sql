-- Terugdraaien van 0011. Partners, leden, aanvragen, producten, campagnes, gesponsorde items,
-- samenwerkingen en statistiek gaan verloren (dat is de bedoeling); recepten en makers blijven.
-- Vereist dat 0012 eerst teruggedraaid is (abonnementen verwijzen naar partners).
BEGIN;
DROP TABLE IF EXISTS public.gesponsord_statistiek;
DROP TABLE IF EXISTS public.samenwerkingen;
DROP TABLE IF EXISTS public.gesponsorde_items;
DROP TABLE IF EXISTS public.campagnes;
DROP TABLE IF EXISTS public.partner_producten;
DROP TABLE IF EXISTS public.partner_aanvragen;
DROP TABLE IF EXISTS public.partner_leden;
DROP TABLE IF EXISTS public.partners;
DROP FUNCTION IF EXISTS public.gesponsord_tel(uuid, text);
DROP FUNCTION IF EXISTS public.campagne_is_concept(uuid);
DROP FUNCTION IF EXISTS public.campagne_partner(uuid);
DROP FUNCTION IF EXISTS public.campagne_loopt(uuid);
DROP FUNCTION IF EXISTS public.partner_mag(uuid, text);
DROP FUNCTION IF EXISTS public.partner_rol(uuid);
DROP FUNCTION IF EXISTS public.bewaak_eigenaar();
DROP FUNCTION IF EXISTS public.bewaak_campagne();
DROP FUNCTION IF EXISTS public.bewaak_partner();
DROP TRIGGER IF EXISTS recipe_publicaties_reden ON public.recipe_publicaties;
DROP FUNCTION IF EXISTS public.wis_moderatie_reden();
ALTER TABLE public.recipe_publicaties DROP COLUMN IF EXISTS moderatie_reden;
COMMIT;
