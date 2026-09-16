DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.samen_in_groep(auth.uid(), id)
  OR EXISTS (
    SELECT 1 FROM public.shares s
    WHERE s.status IN ('pending', 'accepted')
      AND (
        (s.owner_id = auth.uid() AND s.member_id = profiles.id)
        OR (s.member_id = auth.uid() AND s.owner_id = profiles.id)
      )
  )
);