GRANT SELECT (weekmenu) ON public.profiles TO authenticated;
REVOKE UPDATE (admin_note, blocked_at) ON public.profiles FROM authenticated;