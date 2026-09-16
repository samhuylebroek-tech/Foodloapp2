-- AI-gebruik: werkelijke kost en technische details
ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS tokens_in integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_out integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beelden integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kost_eur numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS error_code text;

-- Gebeurtenissen: uitbreidbaar detailveld
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS detail jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS usage_events_user_tijd ON public.usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_tijd ON public.usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_user_tijd ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_tijd ON public.ai_usage (created_at DESC);

-- Fouten die gebruikers ervaren
CREATE TABLE IF NOT EXISTS public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  soort text NOT NULL DEFAULT 'runtime',
  feature text NOT NULL DEFAULT '',
  bericht text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.app_errors TO authenticated;
GRANT ALL ON public.app_errors TO service_role;
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_errors_eigen_insert ON public.app_errors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS app_errors_user_tijd ON public.app_errors (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_errors_tijd ON public.app_errors (created_at DESC);

-- Dagaggregaties
CREATE TABLE IF NOT EXISTS public.daily_user_stats (
  dag date NOT NULL,
  user_id uuid NOT NULL,
  handelingen integer NOT NULL DEFAULT 0,
  sessies integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  kost_eur numeric(12,6) NOT NULL DEFAULT 0,
  recepten integer NOT NULL DEFAULT 0,
  imports integer NOT NULL DEFAULT 0,
  plan_items integer NOT NULL DEFAULT 0,
  fouten integer NOT NULL DEFAULT 0,
  bijgewerkt timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dag, user_id)
);
GRANT ALL ON public.daily_user_stats TO service_role;
ALTER TABLE public.daily_user_stats ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.daily_platform_stats (
  dag date PRIMARY KEY,
  nieuwe_gebruikers integer NOT NULL DEFAULT 0,
  actieve_gebruikers integer NOT NULL DEFAULT 0,
  sessies integer NOT NULL DEFAULT 0,
  handelingen integer NOT NULL DEFAULT 0,
  nieuwe_recepten integer NOT NULL DEFAULT 0,
  imports integer NOT NULL DEFAULT 0,
  weekmenus integer NOT NULL DEFAULT 0,
  lijsten integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  kost_eur numeric(12,6) NOT NULL DEFAULT 0,
  fouten integer NOT NULL DEFAULT 0,
  bijgewerkt timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.daily_platform_stats TO service_role;
ALTER TABLE public.daily_platform_stats ENABLE ROW LEVEL SECURITY;

-- Prijslijst per model (werkelijke kost, geen credits)
CREATE TABLE IF NOT EXISTS public.model_prices (
  model text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'lovable',
  eur_per_1m_in numeric(12,6) NOT NULL DEFAULT 0,
  eur_per_1m_out numeric(12,6) NOT NULL DEFAULT 0,
  eur_per_beeld numeric(12,6) NOT NULL DEFAULT 0,
  eur_per_call numeric(12,6) NOT NULL DEFAULT 0,
  actief boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.model_prices TO authenticated;
GRANT ALL ON public.model_prices TO service_role;
ALTER TABLE public.model_prices ENABLE ROW LEVEL SECURITY;

-- Communicatie vanuit het Control Center
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  doelgroep text NOT NULL DEFAULT 'gebruiker',
  doel_id text,
  segment text,
  onderwerp text NOT NULL DEFAULT '',
  bericht text NOT NULL DEFAULT '',
  kanaal text NOT NULL DEFAULT 'in_app',
  ontvangers integer NOT NULL DEFAULT 0,
  verzonden integer NOT NULL DEFAULT 0,
  mislukt integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'klaar',
  fout text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_messages TO service_role;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.admin_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kanaal text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'verzonden',
  fout text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_message_recipients TO service_role;
ALTER TABLE public.admin_message_recipients ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_message_recipients_user ON public.admin_message_recipients (user_id, created_at DESC);