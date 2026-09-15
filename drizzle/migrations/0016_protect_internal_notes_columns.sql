-- Interne notities van het team blijven intern.
REVOKE SELECT ON public.feedback FROM authenticated;
GRANT SELECT (id, user_id, kind, message, page, rating, status, created_at, updated_at)
  ON public.feedback TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

REVOKE SELECT ON public.credit_requests FROM authenticated;
GRANT SELECT (id, user_id, aantal, bericht, status, toegekend, created_at)
  ON public.credit_requests TO authenticated;
GRANT INSERT ON public.credit_requests TO authenticated;
GRANT ALL ON public.credit_requests TO service_role;