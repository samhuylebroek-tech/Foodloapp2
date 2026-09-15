-- PUBLIC had nog uitvoerrechten; die halen we weg en geven we gericht terug.
REVOKE EXECUTE ON FUNCTION public.credits_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credits_afronden(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credits_reserveren(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credits_terugstorten(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credits_toekennen(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credits_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_afronden(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_reserveren(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_terugstorten(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credits_toekennen(uuid, integer, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_users_only_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_recipe_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.groep_eigenaar_lid() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.group_members_geen_rolwissel() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_audit_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_login_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login_stats(uuid) TO service_role;

-- Functies die aangemelde gebruikers wél nodig hebben (uitnodigingen, zoeken, RLS-controles).
REVOKE EXECUTE ON FUNCTION public.accept_share(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decline_share(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.groep_naam(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_group(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.zoek_gebruiker(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_share(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.groep_recht(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.in_groep(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.samen_in_groep(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_admin_role(uuid, admin_role) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.accept_share(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_share(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.groep_naam(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zoek_gebruiker(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_share(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.groep_recht(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.in_groep(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.samen_in_groep(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_admin_role(uuid, admin_role) TO authenticated, service_role;