-- VOORSTEL — NIET UITGEVOERD. Module B: makers (creators), publiceren, volgen, verzamelingen,
-- community en meldingen (MODULE_DESIGNS §3, §5, §6; COMMERCIAL_ROADMAP §1–2).
-- Regels:
-- - niets wordt openbaar zonder uitdrukkelijke keuze; openbaar = eerst moderatie ('wacht'),
--   alleen beheer (of de server) zet 'goedgekeurd' (trigger hieronder);
-- - openbaar gepubliceerde, goedgekeurde recepten en makerprofielen zijn leesbaar voor ingelogde
--   gebruikers (niet voor anon);
-- - volgen is privé: je ziet alleen je eigen rijen; een maker krijgt alleen totalen
--   (maker_statistiek), nooit wie;
-- - meldingen: alleen de indiener en beheer zien ze.
-- De app controleert eerst of deze tabellen bestaan (src/lib/module-beschikbaar.ts) en toont
-- anders "binnenkort". Lokaal getest met tests/rls/makers-community.mjs (PGlite).
-- Terugdraaien: 0008_creators_community.down.sql.

BEGIN;

-- ---------- makers ----------
CREATE TABLE public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text NOT NULL CHECK (handle ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$' AND handle !~ '--'),
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 1 AND 60),
  bio text CHECK (bio IS NULL OR char_length(bio) <= 300),
  specialisaties text[] NOT NULL DEFAULT '{}' CHECK (cardinality(specialisaties) <= 6),
  omslag_url text,
  avatar_url text,
  geverifieerd boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX creators_handle_uniek ON public.creators (lower(handle));

-- ---------- publicaties per recept ----------
CREATE TABLE public.recipe_publicaties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL UNIQUE REFERENCES public.recipes(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  zichtbaarheid text NOT NULL DEFAULT 'prive' CHECK (zichtbaarheid IN ('prive', 'vrienden', 'openbaar')),
  status text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept', 'gepubliceerd')),
  gepubliceerd_op timestamptz,
  video_url text CHECK (video_url IS NULL OR video_url ~ '^https://'),
  moderatie text CHECK (moderatie IN ('wacht', 'goedgekeurd', 'afgewezen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_publicaties_creator_idx ON public.recipe_publicaties (creator_id, gepubliceerd_op DESC);
CREATE INDEX recipe_publicaties_openbaar_idx ON public.recipe_publicaties (recipe_id)
  WHERE zichtbaarheid = 'openbaar' AND status = 'gepubliceerd' AND moderatie = 'goedgekeurd';

-- ---------- volgen ----------
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, creator_id)
);
CREATE INDEX follows_creator_idx ON public.follows (creator_id);

-- ---------- verzamelingen ----------
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(naam) BETWEEN 1 AND 60),
  beschrijving text CHECK (beschrijving IS NULL OR char_length(beschrijving) <= 300),
  openbaar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collections_user_idx ON public.collections (user_id, created_at);

CREATE TABLE public.collection_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  positie integer NOT NULL DEFAULT 0 CHECK (positie >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, recipe_id)
);
CREATE INDEX collection_recipes_recipe_idx ON public.collection_recipes (recipe_id);

-- ---------- community ----------
CREATE TABLE public.community_bijdragen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weergavenaam text CHECK (weergavenaam IS NULL OR char_length(weergavenaam) <= 30),
  tekst text NOT NULL CHECK (char_length(btrim(tekst)) BETWEEN 2 AND 280),
  sterren smallint NOT NULL CHECK (sterren BETWEEN 1 AND 5),
  foto_url text,
  verborgen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_bijdragen_recipe_idx ON public.community_bijdragen (recipe_id, created_at DESC);

-- ---------- meldingen (moderatiewachtrij) ----------
CREATE TABLE public.content_meldingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  melder_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  soort text NOT NULL CHECK (soort IN ('recept', 'bijdrage', 'maker', 'collectie')),
  doel_id uuid NOT NULL,
  reden text NOT NULL CHECK (reden IN ('ongepast', 'onveilig', 'reclame', 'auteursrecht', 'anders')),
  toelichting text CHECK (toelichting IS NULL OR char_length(toelichting) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'behandeld', 'afgewezen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  behandeld_op timestamptz
);
CREATE INDEX content_meldingen_open_idx ON public.content_meldingen (created_at) WHERE status = 'open';
CREATE INDEX content_meldingen_melder_idx ON public.content_meldingen (melder_id, created_at DESC);

-- ---------- hulpfuncties ----------
-- Openbaar = openbaar + gepubliceerd + goedgekeurd + recept niet verwijderd. SECURITY DEFINER:
-- vermijdt recursie tussen de policies van recipes en recipe_publicaties.
CREATE OR REPLACE FUNCTION public.is_openbaar_recept(_recipe uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recipe_publicaties p JOIN public.recipes r ON r.id = p.recipe_id
     WHERE p.recipe_id = _recipe AND p.zichtbaarheid = 'openbaar' AND p.status = 'gepubliceerd'
       AND p.moderatie = 'goedgekeurd' AND r.deleted_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_openbaar_recept(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_openbaar_recept(uuid) TO authenticated, service_role;

-- Moderatie en verificatie kan alleen beheer (of de server) zetten.
CREATE OR REPLACE FUNCTION public.bewaak_publicatie()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.zichtbaarheid = 'openbaar' AND NEW.status = 'gepubliceerd' THEN
    IF TG_OP = 'INSERT'
       OR OLD.zichtbaarheid IS DISTINCT FROM 'openbaar'
       OR OLD.status IS DISTINCT FROM 'gepubliceerd'
       OR NEW.moderatie IS DISTINCT FROM OLD.moderatie
       OR NEW.video_url IS DISTINCT FROM OLD.video_url THEN
      NEW.moderatie := 'wacht';
    END IF;
  ELSE
    NEW.moderatie := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER recipe_publicaties_bewaak BEFORE INSERT OR UPDATE ON public.recipe_publicaties
  FOR EACH ROW EXECUTE FUNCTION public.bewaak_publicatie();

CREATE OR REPLACE FUNCTION public.bewaak_creator()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  NEW.geverifieerd := CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD.geverifieerd END;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER creators_bewaak BEFORE INSERT OR UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.bewaak_creator();

-- Alleen totalen voor de maker zelf (nooit wie).
CREATE OR REPLACE FUNCTION public.maker_statistiek(p_creator uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE eigenaar uuid;
BEGIN
  SELECT user_id INTO eigenaar FROM public.creators WHERE id = p_creator;
  IF eigenaar IS NULL OR eigenaar IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'volgers', (SELECT count(*) FROM public.follows WHERE creator_id = p_creator),
    'bewaard',
      (SELECT count(*) FROM public.favorites f JOIN public.recipe_publicaties p ON p.recipe_id = f.recipe_id
        WHERE p.creator_id = p_creator AND f.user_id <> eigenaar)
      + (SELECT count(*) FROM public.collection_recipes cr
           JOIN public.collections c ON c.id = cr.collection_id
           JOIN public.recipe_publicaties p ON p.recipe_id = cr.recipe_id
          WHERE p.creator_id = p_creator AND c.user_id <> eigenaar),
    'gepland',
      (SELECT count(*) FROM public.meal_plan m JOIN public.recipe_publicaties p ON p.recipe_id = m.recipe_id
        WHERE p.creator_id = p_creator AND m.user_id <> eigenaar)
  );
END; $$;
REVOKE ALL ON FUNCTION public.maker_statistiek(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maker_statistiek(uuid) TO authenticated, service_role;

-- ---------- rechten ----------
REVOKE ALL ON public.creators, public.recipe_publicaties, public.follows, public.collections,
  public.collection_recipes, public.community_bijdragen, public.content_meldingen
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creators, public.recipe_publicaties,
  public.collections, public.collection_recipes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows, public.community_bijdragen TO authenticated;
GRANT SELECT, INSERT ON public.content_meldingen TO authenticated;
GRANT UPDATE (status, behandeld_op) ON public.content_meldingen TO authenticated;
GRANT ALL ON public.creators, public.recipe_publicaties, public.follows, public.collections,
  public.collection_recipes, public.community_bijdragen, public.content_meldingen TO service_role;

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_publicaties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_bijdragen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_meldingen ENABLE ROW LEVEL SECURITY;

-- makers: profielen leesbaar voor ingelogde gebruikers; schrijven alleen het eigen profiel.
CREATE POLICY creators_lezen ON public.creators FOR SELECT TO authenticated USING (true);
CREATE POLICY creators_eigen ON public.creators FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- publicaties: de maker ziet en schrijft de eigen rijen (alleen voor eigen recepten);
-- iedereen (ingelogd) ziet openbaar + gepubliceerd + goedgekeurd.
CREATE POLICY publicaties_openbaar ON public.recipe_publicaties FOR SELECT TO authenticated
  USING (zichtbaarheid = 'openbaar' AND status = 'gepubliceerd' AND moderatie = 'goedgekeurd');
CREATE POLICY publicaties_eigen ON public.recipe_publicaties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.creators c WHERE c.id = creator_id AND c.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

-- recepten en ingrediënten: extra leesregel voor openbare makerrecepten (naast de bestaande).
CREATE POLICY recipes_select_openbaar ON public.recipes AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_openbaar_recept(id));
CREATE POLICY ingredients_select_openbaar ON public.recipe_ingredients AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_openbaar_recept(recipe_id));

-- volgen: privé.
CREATE POLICY follows_eigen ON public.follows FOR ALL TO authenticated
  USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());

-- verzamelingen: eigen + openbare lezen; alleen eigen schrijven.
CREATE POLICY collections_lezen ON public.collections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR openbaar);
CREATE POLICY collections_eigen ON public.collections FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY collection_recipes_lezen ON public.collection_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id
                 AND (c.user_id = auth.uid() OR c.openbaar)));
-- Alleen recepten die je zelf mag zien (RLS van recipes geldt in de subquery).
CREATE POLICY collection_recipes_eigen ON public.collection_recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id)
  );

-- community: alleen op openbare recepten; eigen bijdragen altijd zichtbaar voor jezelf.
CREATE POLICY bijdragen_lezen ON public.community_bijdragen FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (NOT verborgen AND public.is_openbaar_recept(recipe_id)));
CREATE POLICY bijdragen_plaatsen ON public.community_bijdragen FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT verborgen AND public.is_openbaar_recept(recipe_id));
CREATE POLICY bijdragen_verwijderen ON public.community_bijdragen FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- meldingen: indiener en beheer.
CREATE POLICY meldingen_indienen ON public.content_meldingen FOR INSERT TO authenticated
  WITH CHECK (melder_id = auth.uid() AND status = 'open');
CREATE POLICY meldingen_lezen ON public.content_meldingen FOR SELECT TO authenticated
  USING (melder_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY meldingen_behandelen ON public.content_meldingen FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

COMMIT;
