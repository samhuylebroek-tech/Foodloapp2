-- Interne beheernotities en blokkeerstatus mogen nooit door gewone gebruikers gelezen worden.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, handle, taal, thema, momenten, onboarding_klaar, created_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;