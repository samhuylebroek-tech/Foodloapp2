ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS taal text NOT NULL DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS thema text NOT NULL DEFAULT 'sage',
  ADD COLUMN IF NOT EXISTS momenten text[] NOT NULL DEFAULT ARRAY['ontbijt','middageten','avondeten']::text[],
  ADD COLUMN IF NOT EXISTS onboarding_klaar boolean NOT NULL DEFAULT false;

-- Bestaande gebruikers hoeven de instelstappen niet opnieuw te doen.
UPDATE public.profiles SET onboarding_klaar = true WHERE created_at < now();