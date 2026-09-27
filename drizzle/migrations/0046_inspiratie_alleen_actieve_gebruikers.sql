CREATE OR REPLACE FUNCTION public.is_actieve_gebruiker(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user AND p.blocked_at IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.is_actieve_gebruiker(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_actieve_gebruiker(uuid) TO authenticated;

DROP POLICY IF EXISTS "Ingelogde gebruikers lezen inspiratie" ON public.inspiration_recipes;
CREATE POLICY "Actieve gebruikers lezen inspiratie" ON public.inspiration_recipes
  FOR SELECT TO authenticated USING (public.is_actieve_gebruiker(auth.uid()));

DROP POLICY IF EXISTS "Ingelogde gebruikers lezen inspiratie-ingrediënten" ON public.inspiration_ingredients;
CREATE POLICY "Actieve gebruikers lezen inspiratie-ingrediënten" ON public.inspiration_ingredients
  FOR SELECT TO authenticated USING (public.is_actieve_gebruiker(auth.uid()));

DROP POLICY IF EXISTS recipe_photos_read_inspiratie ON storage.objects;
CREATE POLICY recipe_photos_read_inspiratie ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'recipe-photos'
    AND public.is_actieve_gebruiker(auth.uid())
    AND EXISTS (SELECT 1 FROM public.inspiration_recipes i WHERE i.image_url = objects.name)
  );