CREATE TYPE public.admin_role AS ENUM ('super_admin', 'admin', 'support', 'content_manager', 'analyst');

CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role public.admin_role NOT NULL DEFAULT 'support',
  active boolean NOT NULL DEFAULT true,
  can_view_private_content boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_select_own" ON public.admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role public.admin_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND role = _role AND active
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND active);
$$;

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aantal integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO aantal FROM public.admin_users;
  IF aantal > 0 THEN RETURN false; END IF;
  INSERT INTO public.admin_users (user_id, role, active, can_view_private_content, note, created_by)
  VALUES (auth.uid(), 'super_admin', true, true, 'Eerste beheerder', auth.uid());
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role public.admin_role,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.block_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Auditlogboek is onveranderlijk';
END; $$;
CREATE TRIGGER admin_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_audit_mutation();

CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_read" ON public.platform_settings
  FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('feature.ai_import', 'true'::jsonb, 'AI-import van recepten (link, tekst, foto)'),
  ('feature.internet_suggesties', 'true'::jsonb, 'Suggesties van het internet op het startscherm'),
  ('feature.weekmenu', 'true'::jsonb, 'Weekmenu / planner'),
  ('feature.vrienden', 'true'::jsonb, 'Vrienden en delen'),
  ('feature.feedback', 'true'::jsonb, 'Feedbackformulier'),
  ('app.onderhoudsmelding', '""'::jsonb, 'Melding bovenaan de app (leeg = geen melding)');

CREATE TABLE public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'chat',
  model text NOT NULL DEFAULT '',
  ok boolean NOT NULL DEFAULT true,
  duration_ms integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_events_created_idx ON public.ai_events (created_at DESC);
GRANT ALL ON public.ai_events TO service_role;
ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
DROP POLICY IF EXISTS "recipes_select" ON public.recipes;
CREATE POLICY "recipes_select" ON public.recipes
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nieuw';
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT '';