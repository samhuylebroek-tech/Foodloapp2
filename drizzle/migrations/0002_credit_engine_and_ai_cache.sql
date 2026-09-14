-- 1) Kostenconfiguratie per AI-functie
CREATE TABLE public.credit_costs (
  feature text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  credit_cost integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  max_per_dag integer NOT NULL DEFAULT 50,
  model text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_costs TO authenticated;
GRANT ALL ON public.credit_costs TO service_role;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_costs_read ON public.credit_costs FOR SELECT TO authenticated USING (true);

-- 2) Creditpakketten (verkoop staat voorlopig uit)
CREATE TABLE public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  credits integer NOT NULL,
  bonus integer NOT NULL DEFAULT 0,
  prijs_cent integer NOT NULL,
  valuta text NOT NULL DEFAULT 'EUR',
  actief boolean NOT NULL DEFAULT true,
  volgorde integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packs TO authenticated;
GRANT ALL ON public.credit_packs TO service_role;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_packs_read ON public.credit_packs FOR SELECT TO authenticated USING (actief);

-- 3) Saldo per gebruiker (server-side waarheid)
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  gratis_totaal integer NOT NULL DEFAULT 0,
  gekocht_totaal integer NOT NULL DEFAULT 0,
  gebruikt_totaal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_credits_own ON public.user_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 4) Onveranderlijk grootboek
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  feature text,
  reference_id text,
  status text NOT NULL DEFAULT 'voltooid',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_transactions_user_idx ON public.credit_transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX credit_transactions_ref_idx ON public.credit_transactions (type, reference_id)
  WHERE reference_id IS NOT NULL;
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_transactions_own ON public.credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 5) AI-resultaatcache: dezelfde invoer kost nooit twee keer credits
CREATE TABLE public.ai_cache (
  input_hash text PRIMARY KEY,
  feature text NOT NULL,
  model text NOT NULL DEFAULT '',
  prompt_version integer NOT NULL DEFAULT 1,
  result jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT ALL ON public.ai_cache TO service_role;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- 6) Kostenmeting per AI-verzoek
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feature text NOT NULL,
  model text NOT NULL DEFAULT '',
  cache_hit boolean NOT NULL DEFAULT false,
  credits integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_created_idx ON public.ai_usage (created_at DESC);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_admin ON public.ai_usage FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7) Standaardwaarden
INSERT INTO public.credit_costs (feature, label, credit_cost, max_per_dag, model) VALUES
  ('import_url', 'Recept uit een link', 1, 40, 'google/gemini-3.8-flash'),
  ('import_tekst', 'Recept uit tekst', 1, 40, 'google/gemini-3.8-flash'),
  ('import_foto', 'Recept uit schermafbeelding', 3, 20, 'google/gemini-3.8-flash'),
  ('gerecht_foto', 'Gerecht herkennen op foto', 3, 20, 'google/gemini-3.8-flash'),
  ('ingredienten_foto', 'Ingrediënten herkennen', 2, 20, 'google/gemini-3.1-flash-lite'),
  ('suggesties', 'Nieuw voor jou', 1, 20, 'google/gemini-3.8-flash'),
  ('foto_maken', 'Sfeerfoto laten maken', 2, 20, 'google/gemini-3.1-flash-lite-image'),
  ('vertalen', 'Vertalen', 0, 200, 'google/gemini-3.8-flash');

INSERT INTO public.credit_packs (naam, credits, bonus, prijs_cent, volgorde) VALUES
  ('Starter', 100, 0, 299, 1),
  ('Plus', 500, 100, 999, 2),
  ('Value', 1500, 400, 2499, 3),
  ('Pro', 5000, 1500, 6999, 4);

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('credits_actief', 'true'::jsonb, 'Creditsysteem aan of uit'),
  ('credits_kopen_actief', 'false'::jsonb, 'Kunnen gebruikers credits kopen?'),
  ('gratis_credits', '50'::jsonb, 'Gratis credits bij registratie'),
  ('credits_waarschuwing', '10'::jsonb, 'Toon waarschuwing onder dit saldo')
ON CONFLICT (key) DO NOTHING;

-- 8) Creditmotor
CREATE OR REPLACE FUNCTION public.credits_account(_user uuid)
RETURNS public.user_credits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rij public.user_credits; _gratis integer;
BEGIN
  SELECT * INTO _rij FROM public.user_credits WHERE user_id = _user;
  IF FOUND THEN RETURN _rij; END IF;
  SELECT COALESCE((value #>> '{}')::integer, 50) INTO _gratis FROM public.platform_settings WHERE key = 'gratis_credits';
  _gratis := COALESCE(_gratis, 50);
  INSERT INTO public.user_credits (user_id, balance, gratis_totaal)
  VALUES (_user, _gratis, _gratis)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (_user, 'signup_bonus', _gratis, _gratis, 'signup:' || _user::text)
  ON CONFLICT DO NOTHING;
  SELECT * INTO _rij FROM public.user_credits WHERE user_id = _user;
  RETURN _rij;
END; $$;

CREATE OR REPLACE FUNCTION public.credits_reserveren(_user uuid, _feature text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cost integer; _enabled boolean; _limiet integer; _saldo integer; _txn uuid; _vandaag integer; _actief boolean;
BEGIN
  SELECT COALESCE((value #>> '{}')::boolean, true) INTO _actief FROM public.platform_settings WHERE key = 'credits_actief';
  SELECT credit_cost, enabled, max_per_dag INTO _cost, _enabled, _limiet FROM public.credit_costs WHERE feature = _feature;
  IF _cost IS NULL THEN _cost := 1; _enabled := true; _limiet := 50; END IF;
  IF NOT _enabled THEN RAISE EXCEPTION 'FUNCTIE_UIT'; END IF;

  PERFORM public.credits_account(_user);

  SELECT count(*) INTO _vandaag FROM public.credit_transactions
   WHERE user_id = _user AND feature = _feature AND type = 'usage' AND created_at > now() - interval '1 day';
  IF _vandaag >= COALESCE(_limiet, 50) THEN RAISE EXCEPTION 'DAGLIMIET'; END IF;

  IF COALESCE(_actief, true) = false OR _cost <= 0 THEN
    SELECT balance INTO _saldo FROM public.user_credits WHERE user_id = _user;
    RETURN jsonb_build_object('txn', NULL, 'kosten', 0, 'saldo', _saldo);
  END IF;

  SELECT balance INTO _saldo FROM public.user_credits WHERE user_id = _user FOR UPDATE;
  IF _saldo < _cost THEN RAISE EXCEPTION 'ONVOLDOENDE_CREDITS'; END IF;

  UPDATE public.user_credits
     SET balance = balance - _cost, gebruikt_totaal = gebruikt_totaal + _cost, updated_at = now()
   WHERE user_id = _user
   RETURNING balance INTO _saldo;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, feature, status)
  VALUES (_user, 'usage', -_cost, _saldo, _feature, 'gereserveerd')
  RETURNING id INTO _txn;

  RETURN jsonb_build_object('txn', _txn, 'kosten', _cost, 'saldo', _saldo);
END; $$;

CREATE OR REPLACE FUNCTION public.credits_afronden(_txn uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.credit_transactions SET status = 'voltooid' WHERE id = _txn AND status = 'gereserveerd';
END; $$;

CREATE OR REPLACE FUNCTION public.credits_terugstorten(_txn uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r public.credit_transactions; _saldo integer;
BEGIN
  SELECT * INTO _r FROM public.credit_transactions WHERE id = _txn AND status = 'gereserveerd' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.user_credits
     SET balance = balance - _r.amount, gebruikt_totaal = greatest(0, gebruikt_totaal + _r.amount), updated_at = now()
   WHERE user_id = _r.user_id
   RETURNING balance INTO _saldo;
  UPDATE public.credit_transactions SET status = 'teruggestort' WHERE id = _txn;
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, feature, reference_id)
  VALUES (_r.user_id, 'refund', -_r.amount, _saldo, _r.feature, 'refund:' || _txn::text)
  ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.credits_toekennen(_user uuid, _amount integer, _type text, _ref text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _saldo integer;
BEGIN
  PERFORM public.credits_account(_user);
  UPDATE public.user_credits
     SET balance = balance + _amount,
         gekocht_totaal = gekocht_totaal + CASE WHEN _type = 'purchase' THEN _amount ELSE 0 END,
         gratis_totaal = gratis_totaal + CASE WHEN _type <> 'purchase' AND _amount > 0 THEN _amount ELSE 0 END,
         updated_at = now()
   WHERE user_id = _user
   RETURNING balance INTO _saldo;
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (_user, _type, _amount, _saldo, _ref)
  ON CONFLICT DO NOTHING;
  RETURN _saldo;
END; $$;

REVOKE ALL ON FUNCTION public.credits_account(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_reserveren(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_afronden(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_terugstorten(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.credits_toekennen(uuid, integer, text, text) FROM anon, authenticated;

-- 9) Nieuwe gebruikers krijgen automatisch hun gratis credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.credits_account(NEW.id);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 10) Bestaande gebruikers behouden alles en krijgen hun gratis tegoed
INSERT INTO public.user_credits (user_id, balance, gratis_totaal)
SELECT u.id, 50, 50 FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, reference_id)
SELECT c.user_id, 'signup_bonus', c.balance, c.balance, 'signup:' || c.user_id::text
FROM public.user_credits c
ON CONFLICT DO NOTHING;
