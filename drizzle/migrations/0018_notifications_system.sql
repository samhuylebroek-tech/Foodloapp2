CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_menu_on boolean NOT NULL DEFAULT true,
  daily_menu_time time NOT NULL DEFAULT '10:00',
  daily_menu_moments text[] NOT NULL DEFAULT ARRAY['avondeten','maaltijd'],
  weekly_on boolean NOT NULL DEFAULT true,
  weekly_dow smallint NOT NULL DEFAULT 0,
  weekly_time time NOT NULL DEFAULT '10:00',
  meal_on boolean NOT NULL DEFAULT true,
  meal_lead_min integer NOT NULL DEFAULT 60,
  shopping_on boolean NOT NULL DEFAULT true,
  shopping_time time NOT NULL DEFAULT '17:00',
  cooking_on boolean NOT NULL DEFAULT true,
  cooking_lead_min integer NOT NULL DEFAULT 15,
  lockscreen_details boolean NOT NULL DEFAULT true,
  tijdzone text NOT NULL DEFAULT 'Europe/Brussels',
  onboarding_gezien boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen voorkeuren" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '',
  actief boolean NOT NULL DEFAULT true,
  fail_count integer NOT NULL DEFAULT 0,
  last_ok_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id) WHERE actief;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen toestellen" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL,
  titel text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '/',
  status text NOT NULL DEFAULT 'sent',
  fout text,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  clicked_at timestamptz,
  CONSTRAINT notification_log_dedupe UNIQUE (dedupe_key)
);

CREATE INDEX notification_log_user_idx ON public.notification_log (user_id, created_at DESC);
CREATE INDEX notification_log_soort_idx ON public.notification_log (soort, created_at DESC);
GRANT SELECT, UPDATE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eigen meldingen lezen" ON public.notification_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "eigen melding aangetikt" ON public.notification_log
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_defaults (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  omschrijving text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_defaults TO authenticated;
GRANT ALL ON public.notification_defaults TO service_role;
ALTER TABLE public.notification_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standaarden lezen" ON public.notification_defaults
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.notification_defaults (key, value, omschrijving) VALUES
  ('daily_menu', '{"on": true, "time": "10:00"}', 'Menu van vandaag'),
  ('weekly', '{"on": true, "dow": 0, "time": "10:00"}', 'Weekmenu plannen'),
  ('meal', '{"on": true, "lead_min": 60}', 'Maaltijdherinnering'),
  ('shopping', '{"on": true, "time": "17:00"}', 'Boodschappen'),
  ('cooking', '{"on": true, "lead_min": 15}', 'Tijd om te koken');