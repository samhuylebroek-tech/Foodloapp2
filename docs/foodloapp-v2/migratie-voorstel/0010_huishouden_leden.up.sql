-- VOORSTEL — NIET UITGEVOERD. Gezinsleden met voorkeuren, mee-eters per maaltijd en een
-- veiligheidsoordeel zonder reden (MODULE_DESIGNS §4, DATABASE_ARCHITECTURE §5 "opzet 0005",
-- hier als 0010 omdat 0005 gereserveerd is). Vereist 0009 niet, wel de gezinstabellen
-- (groups, group_members) en meal_plan.
-- Regels:
-- - huishouden_leden: zichtbaar voor actieve leden van dat gezin (naam en rol, geen voeding);
--   leden zonder account (kinderen) worden beheerd door beheerder_id;
-- - lid_voeding (bijzondere gegevens, AVG art. 9): lezen en schrijven alleen door het lid zelf
--   (met account) of de beheerder (zonder account); andere gezinsleden lezen de rij alleen als
--   delen_met_gezin aan staat;
-- - wie plant, krijgt voor de anderen alleen waar/onwaar per lid via maaltijd_veilig_voor
--   (SECURITY DEFINER), nooit welke allergie of welk dieet;
-- - maaltijd_eters: wie de maaltijd mag zien, ziet en zet de mee-eters (binnen het eigen gezin);
-- - persoonlijke_voeding (0009) wordt hier NIET gelezen: die is "alleen voor jou".
-- Lokaal getest met tests/rls/huishouden-voeding.mjs (PGlite). Terugdraaien: 0010_…down.sql.

BEGIN;

-- ---------- hulpfuncties ----------
CREATE OR REPLACE FUNCTION public.is_actief_gezinslid(_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members m
    WHERE m.group_id = _group AND m.user_id = auth.uid() AND m.status = 'actief'
  );
$$;

-- ---------- gezinsleden (ook zonder account) ----------
CREATE TABLE public.huishouden_leden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  naam text NOT NULL CHECK (char_length(btrim(naam)) BETWEEN 1 AND 40),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rol text NOT NULL DEFAULT 'volwassene' CHECK (rol IN ('volwassene', 'kind')),
  beheerder_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX huishouden_leden_groep_idx ON public.huishouden_leden (group_id);
CREATE UNIQUE INDEX huishouden_leden_account_uniek ON public.huishouden_leden (group_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mag_lid_beheren(_lid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.huishouden_leden l
    WHERE l.id = _lid
      AND public.is_actief_gezinslid(l.group_id)
      AND ((l.user_id IS NOT NULL AND l.user_id = auth.uid())
        OR (l.user_id IS NULL AND l.beheerder_id = auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.lid_in_mijn_gezin(_lid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.huishouden_leden l
    WHERE l.id = _lid AND public.is_actief_gezinslid(l.group_id)
  );
$$;

ALTER TABLE public.huishouden_leden ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.huishouden_leden FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.huishouden_leden TO authenticated;
CREATE POLICY huishouden_leden_lezen ON public.huishouden_leden
  FOR SELECT TO authenticated USING (public.is_actief_gezinslid(group_id));
-- Toevoegen: jezelf (met account) of iemand zonder account die jij beheert.
CREATE POLICY huishouden_leden_maken ON public.huishouden_leden
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_actief_gezinslid(group_id)
    AND beheerder_id = auth.uid()
    AND (user_id IS NULL OR user_id = auth.uid())
  );
CREATE POLICY huishouden_leden_wijzigen ON public.huishouden_leden
  FOR UPDATE TO authenticated
  USING (public.is_actief_gezinslid(group_id) AND (user_id = auth.uid() OR (user_id IS NULL AND beheerder_id = auth.uid())))
  WITH CHECK (public.is_actief_gezinslid(group_id) AND (user_id = auth.uid() OR (user_id IS NULL AND beheerder_id = auth.uid())));
-- Weghalen: het lid zelf, de beheerder, of de eigenaar van het gezin.
CREATE POLICY huishouden_leden_wissen ON public.huishouden_leden
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR beheerder_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- ---------- voeding per lid ----------
CREATE TABLE public.lid_voeding (
  lid_id uuid PRIMARY KEY REFERENCES public.huishouden_leden(id) ON DELETE CASCADE,
  allergieen text[] NOT NULL DEFAULT '{}' CHECK (
    allergieen <@ ARRAY['gluten','schaaldieren','eieren','vis','pindas','soja','melk','noten',
      'selder','mosterd','sesam','sulfiet','lupine','weekdieren']::text[]
  ),
  intoleranties text[] NOT NULL DEFAULT '{}' CHECK (
    intoleranties <@ ARRAY['lactose','gluten','fructose','histamine']::text[]
  ),
  dieet text CHECK (dieet IS NULL OR dieet IN ('alles','weinig-vlees','pescotarisch','vegetarisch','veganistisch')),
  uitsluitingen text[] NOT NULL DEFAULT '{}' CHECK (
    cardinality(uitsluitingen) <= 20 AND char_length(array_to_string(uitsluitingen, '')) <= 800
  ),
  delen_met_gezin boolean NOT NULL DEFAULT false,
  toestemming_door uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  toestemming_soort text NOT NULL CHECK (toestemming_soort IN ('zelf', 'beheerder')),
  toestemming_op timestamptz NOT NULL,
  bijgewerkt_op timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lid_voeding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lid_voeding FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lid_voeding TO authenticated;
CREATE POLICY lid_voeding_lezen ON public.lid_voeding
  FOR SELECT TO authenticated
  USING (public.mag_lid_beheren(lid_id) OR (delen_met_gezin AND public.lid_in_mijn_gezin(lid_id)));
CREATE POLICY lid_voeding_maken ON public.lid_voeding
  FOR INSERT TO authenticated
  WITH CHECK (public.mag_lid_beheren(lid_id) AND toestemming_door = auth.uid());
CREATE POLICY lid_voeding_wijzigen ON public.lid_voeding
  FOR UPDATE TO authenticated
  USING (public.mag_lid_beheren(lid_id))
  WITH CHECK (public.mag_lid_beheren(lid_id) AND toestemming_door = auth.uid());
CREATE POLICY lid_voeding_wissen ON public.lid_voeding
  FOR DELETE TO authenticated USING (public.mag_lid_beheren(lid_id));

-- ---------- mee-eters per maaltijd ----------
CREATE TABLE public.maaltijd_eters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid NOT NULL REFERENCES public.meal_plan(id) ON DELETE CASCADE,
  lid_id uuid NOT NULL REFERENCES public.huishouden_leden(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meal_plan_id, lid_id)
);
CREATE INDEX maaltijd_eters_lid_idx ON public.maaltijd_eters (lid_id);

ALTER TABLE public.maaltijd_eters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maaltijd_eters FROM anon;
GRANT SELECT, INSERT, DELETE ON public.maaltijd_eters TO authenticated;
-- De subquery op meal_plan volgt de rechten van de vrager (eigen of gezinsmaaltijd).
CREATE POLICY maaltijd_eters_lezen ON public.maaltijd_eters
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_plan p WHERE p.id = meal_plan_id) AND public.lid_in_mijn_gezin(lid_id));
CREATE POLICY maaltijd_eters_maken ON public.maaltijd_eters
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_plan p WHERE p.id = meal_plan_id) AND public.lid_in_mijn_gezin(lid_id));
CREATE POLICY maaltijd_eters_wissen ON public.maaltijd_eters
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_plan p WHERE p.id = meal_plan_id));

-- ---------- woordenlijst (zelfde als src/lib/allergenen.ts; geen persoonsgegevens) ----------
CREATE TABLE public.allergeen_woorden (
  code text NOT NULL,
  woord text NOT NULL,
  niet boolean NOT NULL DEFAULT false,
  PRIMARY KEY (code, woord, niet)
);
ALTER TABLE public.allergeen_woorden ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.allergeen_woorden TO authenticated;
CREATE POLICY allergeen_woorden_lezen ON public.allergeen_woorden FOR SELECT TO authenticated USING (true);
INSERT INTO public.allergeen_woorden (code, woord, niet) VALUES
  ('gluten','tarwe',false),
  ('gluten','bloem',false),
  ('gluten','spelt',false),
  ('gluten','rogge',false),
  ('gluten','gerst',false),
  ('gluten','haver',false),
  ('gluten','pasta',false),
  ('gluten','spaghetti',false),
  ('gluten','tagliatelle',false),
  ('gluten','lasagne',false),
  ('gluten','macaroni',false),
  ('gluten','noedel',false),
  ('gluten','brood',false),
  ('gluten','paneermeel',false),
  ('gluten','couscous',false),
  ('gluten','bulgur',false),
  ('gluten','bier',false),
  ('gluten','seitan',false),
  ('gluten','peperkoek',false),
  ('gluten','beschuit',false),
  ('gluten','bladerdeeg',false),
  ('gluten','pizzadeeg',false),
  ('gluten','wrap',false),
  ('gluten','tortilla',false),
  ('gluten','croutons',false),
  ('gluten','bloemkool',true),
  ('gluten','maisbloem',true),
  ('gluten','rijstbloem',true),
  ('gluten','glutenvrij',true),
  ('gluten','boekweit',true),
  ('gluten','rijstnoedel',true),
  ('gluten','maistortilla',true),
  ('gluten','zonnebloem',true),
  ('schaaldieren','garna',false),
  ('schaaldieren','krab',false),
  ('schaaldieren','kreeft',false),
  ('schaaldieren','scampi',false),
  ('schaaldieren','langoustine',false),
  ('schaaldieren','rivierkreeft',false),
  ('eieren','ei',false),
  ('eieren','eieren',false),
  ('eieren','eigeel',false),
  ('eieren','eiwit',false),
  ('eieren','eidooier',false),
  ('eieren','mayonaise',false),
  ('eieren','mayo',false),
  ('vis','vis',false),
  ('vis','zalm',false),
  ('vis','tonijn',false),
  ('vis','kabeljauw',false),
  ('vis','ansjovis',false),
  ('vis','makreel',false),
  ('vis','forel',false),
  ('vis','haring',false),
  ('vis','koolvis',false),
  ('vis','tilapia',false),
  ('vis','vissaus',false),
  ('vis','sardien',false),
  ('vis','inktvis',true),
  ('pindas','pinda',false),
  ('pindas','arachide',false),
  ('pindas','satesaus',false),
  ('pindas','pindakaas',false),
  ('soja','soja',false),
  ('soja','tofu',false),
  ('soja','tempeh',false),
  ('soja','edamame',false),
  ('soja','miso',false),
  ('soja','ketjap',false),
  ('melk','melk',false),
  ('melk','room',false),
  ('melk','boter',false),
  ('melk','kaas',false),
  ('melk','yoghurt',false),
  ('melk','mascarpone',false),
  ('melk','ricotta',false),
  ('melk','parmezaan',false),
  ('melk','mozzarella',false),
  ('melk','feta',false),
  ('melk','karnemelk',false),
  ('melk','kwark',false),
  ('melk','creme fraiche',false),
  ('melk','zure room',false),
  ('melk','geitenkaas',false),
  ('melk','emmentaler',false),
  ('melk','gruyere',false),
  ('melk','cheddar',false),
  ('melk','burrata',false),
  ('melk','kokosmelk',true),
  ('melk','amandelmelk',true),
  ('melk','havermelk',true),
  ('melk','sojamelk',true),
  ('melk','rijstmelk',true),
  ('melk','pindakaas',true),
  ('melk','kokosroom',true),
  ('melk','boterham',true),
  ('noten','hazelno',false),
  ('noten','walno',false),
  ('noten','amandel',false),
  ('noten','cashew',false),
  ('noten','pecan',false),
  ('noten','pistache',false),
  ('noten','macadamia',false),
  ('noten','paranoot',false),
  ('noten','noten',false),
  ('noten','notenmix',false),
  ('noten','nootmuskaat',true),
  ('noten','kokosnoot',true),
  ('selder','selder',false),
  ('selder','selderij',false),
  ('selder','knolselder',false),
  ('selder','bleekselder',false),
  ('mosterd','mosterd',false),
  ('sesam','sesam',false),
  ('sesam','tahin',false),
  ('sulfiet','wijn',false),
  ('sulfiet','wijnazijn',false),
  ('sulfiet','gedroogde abrikoos',false),
  ('sulfiet','wijnsteen',true),
  ('lupine','lupine',false),
  ('weekdieren','mossel',false),
  ('weekdieren','oester',false),
  ('weekdieren','inktvis',false),
  ('weekdieren','calamar',false),
  ('weekdieren','sint jakobsvrucht',false),
  ('weekdieren','coquille',false),
  ('weekdieren','slak',false),
  ('weekdieren','octopus',false);
-- Dieet: vlees en vis (zoals soortVan in src/lib/weekmenu-voorstel.ts), plus dierlijk.
INSERT INTO public.allergeen_woorden (code, woord, niet)
SELECT 'vlees', w, false FROM unnest(ARRAY['vlees','stoofvlees','stoverij','carbonade','vol-au-vent',
  'frikandel','boulet','gyros','kip','rund','gehakt','varken','spek','ham','worst','chorizo','salami',
  'lam','kalkoen','eend','kalfs','biefstuk','steak','ribbetjes','bacon','shoarma','kebab','burger',
  'balletjes','konijn','hesp','pancetta','prosciutto','lardon','gelatine']) AS w
UNION ALL
SELECT 'vlees', w, true FROM unnest(ARRAY['vleesvervang','vleesloos','zonder vlees','vegagehakt',
  'vegetarisch gehakt','veggie gehakt']) AS w
UNION ALL
SELECT 'vis_dieet', w, false FROM unnest(ARRAY['vis','zalm','kabeljauw','tonijn','garnaal','scampi',
  'mossel','inktvis','schol','tong','forel','haring','makreel','sardine','ansjovis','zeewolf',
  'pangasius','tilapia','krab','kreeft','heilbot','coquille','vissaus','oestersaus']) AS w
UNION ALL
SELECT 'dierlijk', w, false FROM unnest(ARRAY['honing','gelatine']) AS w
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.foodlo_norm(_t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(
    translate(lower(coalesce(_t, '')), 'àáâäãèéêëìíîïòóôöõùúûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Komt een allergeen- of dieetcode voor in deze (genormaliseerde) teksten?
CREATE OR REPLACE FUNCTION public.foodlo_bevat(_teksten text[], _code text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(_teksten) AS t(n)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.allergeen_woorden x
        WHERE x.code = _code AND x.niet AND t.n LIKE '%' || public.foodlo_norm(x.woord) || '%')
      AND EXISTS (
        SELECT 1 FROM public.allergeen_woorden w
        WHERE w.code = _code AND NOT w.niet AND (
          CASE
            WHEN position(' ' IN public.foodlo_norm(w.woord)) > 0
              THEN t.n LIKE '%' || public.foodlo_norm(w.woord) || '%'
            WHEN char_length(public.foodlo_norm(w.woord)) <= 3
              THEN (' ' || t.n || ' ') LIKE '% ' || public.foodlo_norm(w.woord) || ' %'
            ELSE t.n LIKE '%' || public.foodlo_norm(w.woord) || '%'
          END))
  );
$$;

/**
 * Veiligheidsoordeel per lid: alleen waar/onwaar (of NULL = niet te controleren, geen
 * ingrediënten), nooit de reden. Alleen voor leden van een gezin waarin je actief lid bent en
 * voor recepten van jezelf of van een actief lid van dat gezin.
 */
CREATE OR REPLACE FUNCTION public.maaltijd_veilig_voor(_recipe uuid, _leden uuid[])
RETURNS TABLE (lid_id uuid, veilig boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _eigenaar uuid;
  _teksten text[];
  _ingr int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT r.user_id INTO _eigenaar FROM public.recipes r WHERE r.id = _recipe;
  IF _eigenaar IS NULL THEN RETURN; END IF;
  SELECT array_agg(public.foodlo_norm(i.name)), count(*) INTO _teksten, _ingr
    FROM public.recipe_ingredients i WHERE i.recipe_id = _recipe;
  _teksten := coalesce(_teksten, '{}') || ARRAY[public.foodlo_norm((SELECT title FROM public.recipes WHERE id = _recipe))];

  RETURN QUERY
  SELECT l.id,
    CASE
      WHEN v.lid_id IS NULL THEN true
      WHEN EXISTS (
        SELECT 1 FROM unnest(
          v.allergieen
          || CASE WHEN 'lactose' = ANY (v.intoleranties) THEN ARRAY['melk'] ELSE '{}'::text[] END
          || CASE WHEN 'gluten' = ANY (v.intoleranties) THEN ARRAY['gluten'] ELSE '{}'::text[] END
        ) AS c(code) WHERE public.foodlo_bevat(_teksten, c.code)) THEN false
      WHEN v.dieet IN ('vegetarisch', 'veganistisch', 'pescotarisch')
        AND public.foodlo_bevat(_teksten, 'vlees') THEN false
      WHEN v.dieet IN ('vegetarisch', 'veganistisch')
        AND (public.foodlo_bevat(_teksten, 'vis_dieet') OR public.foodlo_bevat(_teksten, 'schaaldieren')
          OR public.foodlo_bevat(_teksten, 'weekdieren')) THEN false
      WHEN v.dieet = 'veganistisch'
        AND (public.foodlo_bevat(_teksten, 'melk') OR public.foodlo_bevat(_teksten, 'eieren')
          OR public.foodlo_bevat(_teksten, 'dierlijk')) THEN false
      WHEN EXISTS (
        SELECT 1 FROM unnest(v.uitsluitingen) AS u(term), unnest(_teksten) AS t(n)
        WHERE char_length(public.foodlo_norm(u.term)) >= 3 AND t.n LIKE '%' || public.foodlo_norm(u.term) || '%'
      ) THEN false
      WHEN _ingr = 0 AND (cardinality(v.allergieen) > 0 OR cardinality(v.intoleranties) > 0) THEN NULL
      ELSE true
    END
  FROM public.huishouden_leden l
  LEFT JOIN public.lid_voeding v ON v.lid_id = l.id
  WHERE l.id = ANY (_leden)
    AND public.is_actief_gezinslid(l.group_id)
    AND (_eigenaar = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = l.group_id AND m.user_id = _eigenaar AND m.status = 'actief'));
END;
$$;

REVOKE ALL ON FUNCTION public.maaltijd_veilig_voor(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maaltijd_veilig_voor(uuid, uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.is_actief_gezinslid(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mag_lid_beheren(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lid_in_mijn_gezin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_actief_gezinslid(uuid), public.mag_lid_beheren(uuid),
  public.lid_in_mijn_gezin(uuid) TO authenticated;

COMMIT;
