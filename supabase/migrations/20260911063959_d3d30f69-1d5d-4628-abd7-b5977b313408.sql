INSERT INTO public.admin_users (user_id, role, active, can_view_private_content, note, created_by, read_only, mfa_required)
SELECT u.id, 'super_admin'::admin_role, true, true, 'Eigenaar', u.id, false, false
FROM auth.users u
WHERE u.email = 'samhuylebroek@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET role = 'super_admin', active = true, can_view_private_content = true, read_only = false;