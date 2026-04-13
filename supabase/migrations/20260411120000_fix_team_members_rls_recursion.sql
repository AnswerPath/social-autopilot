-- Fix 42P17: infinite recursion in RLS on team_members (and workspace_members) when
-- policies use EXISTS (SELECT ... FROM same_table). Use SECURITY DEFINER helpers that
-- read membership without re-entering RLS — same pattern as fix_user_roles_rls_recursion.

-- Team membership (team_members table)
CREATE OR REPLACE FUNCTION public.is_active_team_member(p_team_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- user_id may be text or uuid depending on schema; compare as text
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id::text = p_user_id
      AND status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id::text = p_user_id
      AND role::text = 'owner'
      AND status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner_or_admin(p_team_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id::text = p_user_id
      AND role::text IN ('owner', 'admin')
      AND status::text = 'active'
  );
$$;

-- Workspace membership (workspace_members table)
CREATE OR REPLACE FUNCTION public.is_active_workspace_member(p_workspace_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Do not reference workspace_members.status: older schemas omit this column.
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id::text = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_member(p_workspace_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id::text = p_user_id
      AND role::text = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_team_member(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_owner(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_owner_or_admin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_workspace_member(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_admin_member(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner_or_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_member(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_owner_or_admin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_member(uuid, text) TO service_role;

-- teams
DROP POLICY IF EXISTS "Users can view teams they belong to" ON public.teams;
CREATE POLICY "Users can view teams they belong to" ON public.teams
  FOR SELECT USING (public.is_active_team_member(id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Team owners can update their teams" ON public.teams;
CREATE POLICY "Team owners can update their teams" ON public.teams
  FOR UPDATE USING (public.is_team_owner(id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK ((SELECT auth.uid())::text = created_by::text);

-- team_members
DROP POLICY IF EXISTS "Team members can view team membership" ON public.team_members;
DROP POLICY IF EXISTS "Users can view team members of teams they belong to" ON public.team_members;
CREATE POLICY "Users can view team members of teams they belong to" ON public.team_members
  FOR SELECT USING (public.is_active_team_member(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Team owners can manage members" ON public.team_members;
CREATE POLICY "Team owners can manage members" ON public.team_members
  FOR ALL
  USING (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text))
  WITH CHECK (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Users can join teams via invitation" ON public.team_members;
CREATE POLICY "Users can join teams via invitation" ON public.team_members
  FOR INSERT WITH CHECK (
    (SELECT auth.uid())::text = user_id::text
    AND EXISTS (
      SELECT 1
      FROM public.team_invitations ti
      WHERE ti.team_id = team_members.team_id
        AND ti.email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
        AND ti.status::text = 'accepted'
    )
  );

-- team_invitations
DROP POLICY IF EXISTS "Team owners can manage invitations" ON public.team_invitations;
CREATE POLICY "Team owners can manage invitations" ON public.team_invitations
  FOR ALL
  USING (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text))
  WITH CHECK (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Invited users can view their invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.team_invitations;
CREATE POLICY "Users can view invitations sent to them" ON public.team_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  );

-- team_content_sharing
DROP POLICY IF EXISTS "Team members can view shared content" ON public.team_content_sharing;
CREATE POLICY "Team members can view shared content" ON public.team_content_sharing
  FOR SELECT USING (public.is_active_team_member(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Team members can share content" ON public.team_content_sharing;
CREATE POLICY "Team members can share content" ON public.team_content_sharing
  FOR INSERT WITH CHECK (
    (SELECT auth.uid())::text = shared_by::text
    AND public.is_active_team_member(team_id, (SELECT auth.uid())::text)
  );

-- team_activity_logs
DROP POLICY IF EXISTS "Team members can view team activity" ON public.team_activity_logs;
DROP POLICY IF EXISTS "Team members can view activity logs" ON public.team_activity_logs;
CREATE POLICY "Team members can view activity logs" ON public.team_activity_logs
  FOR SELECT USING (public.is_active_team_member(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "System can log team activity" ON public.team_activity_logs;
DROP POLICY IF EXISTS "System can insert activity logs" ON public.team_activity_logs;
CREATE POLICY "System can insert activity logs" ON public.team_activity_logs
  FOR INSERT WITH CHECK (true);

-- team_workspaces
DROP POLICY IF EXISTS "Team members can view workspaces" ON public.team_workspaces;
CREATE POLICY "Team members can view workspaces" ON public.team_workspaces
  FOR SELECT USING (public.is_active_team_member(team_id, (SELECT auth.uid())::text));

DROP POLICY IF EXISTS "Team admins can manage workspaces" ON public.team_workspaces;
DROP POLICY IF EXISTS "Team owners can manage workspaces" ON public.team_workspaces;
CREATE POLICY "Team owners can manage workspaces" ON public.team_workspaces
  FOR ALL
  USING (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text))
  WITH CHECK (public.is_team_owner_or_admin(team_id, (SELECT auth.uid())::text));

-- workspace_members (skip if table missing on older DBs)
DO $wrap$
BEGIN
  IF to_regclass('public.workspace_members') IS NULL THEN
    RAISE NOTICE 'Skipping workspace_members policies: table public.workspace_members does not exist';
  ELSE
    EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view membership" ON public.workspace_members';
    EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view other members" ON public.workspace_members';
    EXECUTE 'CREATE POLICY "Workspace members can view other members" ON public.workspace_members
      FOR SELECT USING (public.is_active_workspace_member(workspace_id, (SELECT auth.uid())::text))';
    EXECUTE 'DROP POLICY IF EXISTS "Workspace owners can manage members" ON public.workspace_members';
    EXECUTE 'DROP POLICY IF EXISTS "Workspace admins can manage members" ON public.workspace_members';
    EXECUTE 'CREATE POLICY "Workspace admins can manage members" ON public.workspace_members
      FOR ALL
      USING (public.is_workspace_admin_member(workspace_id, (SELECT auth.uid())::text))
      WITH CHECK (public.is_workspace_admin_member(workspace_id, (SELECT auth.uid())::text))';
  END IF;
END
$wrap$;
