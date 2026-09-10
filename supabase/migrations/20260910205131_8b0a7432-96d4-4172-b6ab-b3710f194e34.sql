REVOKE EXECUTE ON FUNCTION public.decline_share(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decline_share(text) FROM public;
GRANT EXECUTE ON FUNCTION public.decline_share(text) TO authenticated;