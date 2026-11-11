-- Minimale nabootsing van wat Supabase vóór de migraties klaarzet, zodat de migraties uit de repo
-- in een gewone (lokale) PostgreSQL kunnen draaien. Alleen voor de RLS-tests in tests/rls/.
-- Geen echte gegevens, geen verbinding met een Supabase-project.

-- Rollen zoals in Supabase. RLS geldt voor deze rollen (niet voor de eigenaar "postgres").
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
-- Rol die migratie 0019 rechten geeft (tooling van Lovable); hier zonder betekenis.
CREATE ROLE sandbox_exec NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- auth: gebruikers en auth.uid() uit de JWT-claim (zoals PostgREST die zet).
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE auth.audit_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

-- storage: buckets en objecten met RLS, plus storage.foldername() zoals Supabase.
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated, service_role;

-- Realtime-publicatie (de migraties voegen tabellen toe; inhoud doet niet ter zake voor RLS).
CREATE PUBLICATION supabase_realtime;

-- Extensieschema's die de migraties aanspreken voor cron/netwerk (geen rol in RLS).
CREATE SCHEMA extensions;
-- Supabase laadt pgcrypto standaard (gen_random_bytes e.d.); PGlite krijgt het als extensie mee.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(a text, b text, c text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(a text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE SCHEMA net;
CREATE FUNCTION net.http_post(url text, headers jsonb DEFAULT '{}', body jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 1000)
  RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;

-- BUG-011: inspiration_recipes/_ingredients hebben geen CREATE TABLE in de repo. Vorm uit
-- src/integrations/supabase/types.ts, zodat de migraties die ernaar verwijzen kunnen draaien.
CREATE TABLE public.inspiration_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bron_recipe_id uuid,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT '',
  fingerprint text NOT NULL DEFAULT '',
  image_url text,
  instructions text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  prep_minutes int NOT NULL DEFAULT 0,
  cook_minutes int NOT NULL DEFAULT 0,
  servings int NOT NULL DEFAULT 4,
  step_ingredients jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inspiration_recipes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.inspiration_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspiration_id uuid REFERENCES public.inspiration_recipes(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  position int NOT NULL DEFAULT 0,
  quantity numeric,
  unit text NOT NULL DEFAULT ''
);
ALTER TABLE public.inspiration_ingredients ENABLE ROW LEVEL SECURITY;
