ALTER TABLE public.meal_plan ADD COLUMN personen integer;

COMMENT ON COLUMN public.meal_plan.personen IS 'Aantal personen waarvoor dit gerecht is ingepland (vraag bij eerste keer inplannen); NULL = onbekend, dan telt recipes.servings';