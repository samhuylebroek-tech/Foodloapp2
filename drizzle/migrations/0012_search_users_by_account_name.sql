CREATE OR REPLACE FUNCTION public.zoek_gebruiker(_term text)
RETURNS TABLE(id uuid, display_name text, handle text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    CASE
      WHEN lower(p.display_name) = lower(split_part(u.email, '@', 1))
        THEN COALESCE(
          NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
          p.display_name
        )
      ELSE p.display_name
    END AS display_name,
    p.handle
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND length(trim(_term)) >= 2
    AND (
      strpos(lower(p.display_name), lower(trim(_term))) > 0
      OR strpos(lower(COALESCE(u.raw_user_meta_data->>'full_name', '')), lower(trim(_term))) > 0
      OR strpos(lower(COALESCE(u.raw_user_meta_data->>'name', '')), lower(trim(_term))) > 0
      OR (
        p.handle IS NOT NULL
        AND strpos(lower(p.handle), lower(ltrim(trim(_term), '@'))) > 0
      )
      OR lower(u.email) = lower(trim(_term))
    )
  ORDER BY
    CASE
      WHEN lower(p.display_name) = lower(trim(_term)) THEN 0
      WHEN lower(COALESCE(u.raw_user_meta_data->>'full_name', '')) = lower(trim(_term)) THEN 0
      WHEN p.handle IS NOT NULL AND lower(p.handle) = lower(ltrim(trim(_term), '@')) THEN 1
      ELSE 2
    END,
    p.display_name
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.zoek_gebruiker(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zoek_gebruiker(text) TO authenticated, service_role;