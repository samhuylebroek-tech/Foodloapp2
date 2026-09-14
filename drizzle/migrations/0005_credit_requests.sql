CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aantal integer NOT NULL DEFAULT 0,
  bericht text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  toegekend integer NOT NULL DEFAULT 0,
  admin_note text NOT NULL DEFAULT '',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.credit_requests TO authenticated;
GRANT ALL ON public.credit_requests TO service_role;

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen aanvragen lezen" ON public.credit_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "eigen aanvraag indienen" ON public.credit_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX credit_requests_status_idx ON public.credit_requests (status, created_at DESC);
CREATE INDEX credit_requests_user_idx ON public.credit_requests (user_id, created_at DESC);