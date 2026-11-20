-- Terugdraaien van 0020. De gekozen plekken gaan verloren; de app gokt weer op basis van de naam
-- (of gebruikt de keuze op het toestel). De voorraad zelf blijft.
ALTER TABLE public.pantry_items DROP COLUMN IF EXISTS plek;
