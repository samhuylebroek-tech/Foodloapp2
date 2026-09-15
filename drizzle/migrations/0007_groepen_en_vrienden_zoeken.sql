-- 1. Groepen (gezin / huishouden)
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL DEFAULT 'Mijn gezin',
  owner_id uuid NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX groups_token_key ON public.groups (token);
CREATE INDEX groups_owner_idx ON public.groups (owner_id);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rol text NOT NULL DEFAULT 'lid',
  recipes_view boolean NOT NULL DEFAULT true,
  recipes_edit boolean NOT NULL DEFAULT true,
  planner_view boolean NOT NULL DEFAULT true,
  planner_edit boolean NOT NULL DEFAULT true,
  shopping_view boolean NOT NULL DEFAULT true,
  shopping_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON public.group_members (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

-- 2. Hulpfuncties (security definer, geen RLS-recursie)
CREATE OR REPLACE FUNCTION public.in_groep(_user uuid, _group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = _group AND m.user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.samen_in_groep(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members x
    JOIN public.group_members y ON y.group_id = x.group_id
    WHERE x.user_id = _a AND y.user_id = _b
  );
$$;

CREATE OR REPLACE FUNCTION public.groep_recht(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members o
    JOIN public.group_members v ON v.group_id = o.group_id AND v.user_id = _viewer
    WHERE o.user_id = _owner
      AND CASE _perm
        WHEN 'recipes_view'  THEN o.recipes_view OR o.recipes_edit
        WHEN 'recipes_edit'  THEN o.recipes_edit
        WHEN 'planner_view'  THEN o.planner_view OR o.planner_edit
        WHEN 'planner_edit'  THEN o.planner_edit
        WHEN 'shopping_view' THEN o.shopping_view OR o.shopping_edit
        WHEN 'shopping_edit' THEN o.shopping_edit
        ELSE false END
  );
$$;

CREATE OR REPLACE FUNCTION public.has_share(_owner uuid, _viewer uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = _viewer
    OR EXISTS (
      SELECT 1 FROM public.shares s
      WHERE s.owner_id = _owner AND s.member_id = _viewer AND s.status = 'accepted'
        AND CASE _perm
          WHEN 'recipes_view'  THEN s.recipes_view OR s.recipes_edit
          WHEN 'recipes_edit'  THEN s.recipes_edit
          WHEN 'planner_view'  THEN s.planner_view OR s.planner_edit
          WHEN 'planner_edit'  THEN s.planner_edit
          WHEN 'shopping_view' THEN s.shopping_view OR s.shopping_edit
          WHEN 'shopping_edit' THEN s.shopping_edit
          ELSE false END
    )
    OR public.groep_recht(_owner, _viewer, _perm);
$$;

-- 3. RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.in_groep(auth.uid(), id));
CREATE POLICY groups_insert ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_update ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY groups_delete ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_members_select ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.in_groep(auth.uid(), group_id));
CREATE POLICY group_members_update ON public.group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY group_members_delete ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.groep_eigenaar_lid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, rol)
  VALUES (NEW.id, NEW.owner_id, 'eigenaar')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER groups_owner_member AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.groep_eigenaar_lid();

-- 4. Meedoen met een groep via uitnodigingslink
CREATE OR REPLACE FUNCTION public.join_group(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'niet aangemeld'; END IF;
  SELECT * INTO g FROM public.groups WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'groep niet gevonden'; END IF;
  INSERT INTO public.group_members (group_id, user_id, rol)
  VALUES (g.id, auth.uid(), 'lid')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN g.id;
END; $$;

CREATE OR REPLACE FUNCTION public.groep_naam(_token text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT naam FROM public.groups WHERE token = _token;
$$;

-- 5. Profielnaam (@handle) + vriend zoeken
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS handle text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON public.profiles (lower(handle));

CREATE OR REPLACE FUNCTION public.zoek_gebruiker(_term text)
RETURNS TABLE (id uuid, display_name text, handle text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.handle
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(trim(_term)) >= 3
    AND (
      lower(p.handle) = lower(ltrim(trim(_term), '@'))
      OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = p.id AND lower(u.email) = lower(trim(_term))
      )
    )
  LIMIT 5;
$$;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.samen_in_groep(auth.uid(), id)
    OR EXISTS (
      SELECT 1 FROM public.shares s
      WHERE s.status = 'accepted'
        AND ((s.owner_id = auth.uid() AND s.member_id = profiles.id)
          OR (s.member_id = auth.uid() AND s.owner_id = profiles.id))
    )
  );

REVOKE EXECUTE ON FUNCTION public.groep_eigenaar_lid() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.in_groep(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.samen_in_groep(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.groep_recht(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.groep_naam(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zoek_gebruiker(text) TO authenticated;