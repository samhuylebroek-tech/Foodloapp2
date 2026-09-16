-- User Intelligence: echte sessies, rijkere gebeurtenissen, bewaarde weergaven

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  einde_geschat boolean NOT NULL DEFAULT false,
  device text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  browser text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  taal text NOT NULL DEFAULT '',
  tijdzone text NOT NULL DEFAULT '',
  events integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessies_eigen_invoegen" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessies_eigen_bijwerken" ON public.user_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessies_eigen_of_admin_lezen" ON public.user_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS user_sessions_user_start_idx ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_start_idx ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_open_idx ON public.user_sessions (last_seen_at DESC) WHERE ended_at IS NULL;

-- Gebeurtenissen verrijken
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS feature text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS entity_label text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS ok boolean;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS browser text;
ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS app_version text;

CREATE INDEX IF NOT EXISTS usage_events_user_tijd_idx ON public.usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_tijd_idx ON public.usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_event_idx ON public.usage_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_session_idx ON public.usage_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS usage_events_feature_idx ON public.usage_events (feature, created_at DESC);

-- Fouten verrijken
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS platform text;
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS browser text;
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS app_version text;

CREATE INDEX IF NOT EXISTS app_errors_user_tijd_idx ON public.app_errors (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_errors_tijd_idx ON public.app_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS app_errors_session_idx ON public.app_errors (session_id);

CREATE INDEX IF NOT EXISTS ai_usage_user_tijd_idx ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_transactions_user_tijd_idx ON public.credit_transactions (user_id, created_at DESC);

-- Bewaarde weergaven voor beheerders
CREATE TABLE IF NOT EXISTS public.admin_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  naam text NOT NULL,
  scherm text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.admin_saved_views TO authenticated;
GRANT ALL ON public.admin_saved_views TO service_role;
ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weergaven_admin_lezen" ON public.admin_saved_views
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) AND admin_id = auth.uid());
CREATE POLICY "weergaven_admin_invoegen" ON public.admin_saved_views
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND admin_id = auth.uid());
CREATE POLICY "weergaven_admin_verwijderen" ON public.admin_saved_views
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND admin_id = auth.uid());

CREATE INDEX IF NOT EXISTS admin_saved_views_admin_idx ON public.admin_saved_views (admin_id, scherm);
