ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekmenu jsonb NOT NULL DEFAULT '{}'::jsonb;