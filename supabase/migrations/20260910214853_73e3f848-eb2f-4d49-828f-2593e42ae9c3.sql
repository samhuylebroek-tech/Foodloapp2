-- 1. admin_users: read-only support mode + MFA requirement
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS read_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT true;

-- 2. admin sessions (IP / device logging)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  ip text,
  user_agent text,
  aal text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_sessions TO authenticated;
GRANT ALL ON public.admin_sessions TO service_role;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sessions" ON public.admin_sessions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON public.admin_sessions (admin_id, last_seen_at DESC);

-- 3. rate limiting for admin actions
CREATE TABLE IF NOT EXISTS public.admin_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_rate_limits TO service_role;
ALTER TABLE public.admin_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_rate_limits_idx ON public.admin_rate_limits (admin_id, created_at DESC);

-- 4. CMS content blocks
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads published content" ON public.site_content
  FOR SELECT TO anon, authenticated USING (published OR public.is_admin(auth.uid()));

INSERT INTO public.site_content (key, title, body) VALUES
  ('welkom', 'Welkom bij MaJeBa', 'Samen koken, samen plannen. Voeg je eerste gerecht toe en ontdek nieuwe ideeën.'),
  ('privacy', 'Privacyverklaring', 'We bewaren enkel wat nodig is om de app te laten werken. Je kunt je gegevens altijd opvragen of laten verwijderen.'),
  ('voorwaarden', 'Gebruiksvoorwaarden', 'Gebruik MaJeBa met respect voor anderen. Deel geen inhoud waarvan je de rechten niet hebt.'),
  ('help', 'Hulp nodig?', 'Laat het ons weten via het feedbackformulier in de app. We helpen je graag verder.')
ON CONFLICT (key) DO NOTHING;

-- 5. announcements shown in the app
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read active announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING ((active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) OR public.is_admin(auth.uid()));

-- 6. lightweight usage analytics
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event text NOT NULL,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users log own usage" ON public.usage_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read usage" ON public.usage_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS usage_events_idx ON public.usage_events (created_at DESC);