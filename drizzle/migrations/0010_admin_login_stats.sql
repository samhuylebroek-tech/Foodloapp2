CREATE OR REPLACE FUNCTION public.admin_login_stats(_user uuid)
RETURNS TABLE(aantal integer, eerste timestamptz, laatste timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT count(*)::int,
         min(created_at)::timestamptz,
         max(created_at)::timestamptz
  FROM auth.audit_log_entries
  WHERE payload->>'action' = 'login'
    AND (payload->>'actor_id') = _user::text;
$$;

REVOKE ALL ON FUNCTION public.admin_login_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_login_stats(uuid) TO service_role;