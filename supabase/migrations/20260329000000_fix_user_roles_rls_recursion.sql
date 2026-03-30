-- Fix PostgreSQL 42P17: infinite recursion in RLS on user_roles when the
-- "Admins can view all roles" policy subqueries user_roles under the same RLS.
-- Also centralize admin checks so other policies do not depend on fragile subqueries.

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()::text)
      AND role = 'ADMIN'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO service_role;

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_current_user_admin());

-- user_permissions (from consolidated schema)
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
CREATE POLICY "Admins can view all permissions" ON public.user_permissions
  FOR SELECT USING (public.is_current_user_admin());

-- granular permissions tables
DROP POLICY IF EXISTS "Admins can view all custom permissions" ON public.custom_permissions;
CREATE POLICY "Admins can view all custom permissions" ON public.custom_permissions
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can create custom permissions" ON public.custom_permissions;
CREATE POLICY "Admins can create custom permissions" ON public.custom_permissions
  FOR INSERT WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update all custom permissions" ON public.custom_permissions;
CREATE POLICY "Admins can update all custom permissions" ON public.custom_permissions
  FOR UPDATE USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view all user custom permissions" ON public.user_custom_permissions;
CREATE POLICY "Admins can view all user custom permissions" ON public.user_custom_permissions
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage user custom permissions" ON public.user_custom_permissions;
CREATE POLICY "Admins can manage user custom permissions" ON public.user_custom_permissions
  FOR ALL USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view all resource permissions" ON public.resource_permissions;
CREATE POLICY "Admins can view all resource permissions" ON public.resource_permissions
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage resource permissions" ON public.resource_permissions;
CREATE POLICY "Admins can manage resource permissions" ON public.resource_permissions
  FOR ALL USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view all permission overrides" ON public.permission_overrides;
CREATE POLICY "Admins can view all permission overrides" ON public.permission_overrides
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage permission overrides" ON public.permission_overrides;
CREATE POLICY "Admins can manage permission overrides" ON public.permission_overrides
  FOR ALL USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view all permission audit logs" ON public.permission_audit_log;
CREATE POLICY "Admins can view all permission audit logs" ON public.permission_audit_log
  FOR SELECT USING (public.is_current_user_admin());

-- activity logging tables
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage activity logs" ON public.activity_logs;
CREATE POLICY "Admins can manage activity logs" ON public.activity_logs
  FOR ALL USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view activity log stats" ON public.activity_log_stats;
CREATE POLICY "Admins can view activity log stats" ON public.activity_log_stats
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view retention policies" ON public.activity_log_retention_policies;
CREATE POLICY "Admins can view retention policies" ON public.activity_log_retention_policies
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can manage retention policies" ON public.activity_log_retention_policies;
CREATE POLICY "Admins can manage retention policies" ON public.activity_log_retention_policies
  FOR ALL USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can view all exports" ON public.activity_log_exports;
CREATE POLICY "Admins can view all exports" ON public.activity_log_exports
  FOR SELECT USING (public.is_current_user_admin());
