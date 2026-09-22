-- Beide tabellen worden enkel via server-side admin-code gelezen.
-- De open leesregels voor ingelogde gebruikers zijn dus niet nodig.

DROP POLICY IF EXISTS "standaarden lezen" ON public.notification_defaults;
REVOKE SELECT ON public.notification_defaults FROM authenticated;
REVOKE SELECT ON public.notification_defaults FROM anon;

DROP POLICY IF EXISTS "credit_costs_read" ON public.credit_costs;
REVOKE SELECT ON public.credit_costs FROM authenticated;
REVOKE SELECT ON public.credit_costs FROM anon;
