INSERT INTO public.platform_settings (key, value, description) VALUES
  ('betalen_actief', 'false'::jsonb, 'Staat betalen aan? Zolang dit uit staat is alles gratis en onbeperkt.'),
  ('gratis_gerechten', '100'::jsonb, 'Aantal gerechten dat gratis mag worden bewaard.'),
  ('pakket_gerechten', '100'::jsonb, 'Aantal extra gerechten per aangekocht pakket.'),
  ('pakket_prijs_cent', '499'::jsonb, 'Prijs van een pakket in eurocent.'),
  ('betaalmodel', '"pakketten"'::jsonb, 'pakketten of eenmalig')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.aankopen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL DEFAULT 'pakket',
  extra_gerechten integer NOT NULL DEFAULT 0,
  bedrag_cent integer NOT NULL DEFAULT 0,
  valuta text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'betaald',
  provider text NOT NULL DEFAULT '',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.aankopen TO authenticated;
GRANT ALL ON public.aankopen TO service_role;

ALTER TABLE public.aankopen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aankopen_select_own" ON public.aankopen
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE TRIGGER aankopen_updated_at
  BEFORE UPDATE ON public.aankopen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();