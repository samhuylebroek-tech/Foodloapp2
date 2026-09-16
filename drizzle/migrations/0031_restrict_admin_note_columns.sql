-- Interne notities en moderatiestatus blijven voortaan buiten bereik van gewone gebruikers.
-- Beheer gebeurt via de service role, die kolomrechten niet nodig heeft.

REVOKE SELECT ON public.credit_requests FROM authenticated;
GRANT SELECT (id, user_id, aantal, bericht, status, toegekend, handled_at, created_at)
  ON public.credit_requests TO authenticated;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, handle, taal, thema, momenten, onboarding_klaar, created_at)
  ON public.profiles TO authenticated;

REVOKE SELECT ON public.credit_requests FROM anon;
REVOKE SELECT ON public.profiles FROM anon;

GRANT ALL ON public.credit_requests TO service_role;
GRANT ALL ON public.profiles TO service_role;