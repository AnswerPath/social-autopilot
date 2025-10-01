import { getSupabaseAdmin } from '@/lib/supabase';
import { isDevMode } from '@/lib/auth-utils';
import { 
  Team, 
  TeamMember, 
  TeamInvitation, 
  TeamContentSharing, 
  TeamActivityLog,
  TeamWorkspace,
  WorkspaceMember,
  TeamRole,
  TeamMemberStatus,
  InvitationStatus,
  ContentType,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ShareContentRequest,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  TeamFilters,
  TeamMemberFilters,
  TeamStats,
  TeamActivityStats,
  TeamPermissions,
  TEAM_ROLE_PERMISSIONS
} from '@/lib/team-types';
import { logActivity, ActivityCategory, ActivityLevel } from '@/lib/activity-logging';
import { NextRequest } from 'next/server';

export class TeamService {
  private static instance: TeamService;
  private supabaseAdmin = getSupabaseAdmin();
  private mockTeams: Team[] = []; // Store mock teams in development mode

  private constructor() {}

  public static getInstance(): TeamService {
    if (!TeamService.instance) {
      TeamService.instance = new TeamService();
    }
    return TeamService.instance;
  }

  // ========================================
  // Team Management
  // ========================================

  /**
   * Create a new team
   */
  async createTeam(
    userId: string,
    teamData: CreateTeamRequest,
    request?: NextRequest
  ): Promise<{ success: boolean; team?: Team; error?: string }> {
    try {
      // Handle development mode
      if (isDevMode()) {
        // console.log('🚀 Creating mock team in development mode')
        const mockTeam: Team = {
          id: `team-${Date.now()}`,
          name: teamData.name,
          slug: teamData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          description: teamData.description || '',
          industry: teamData.industry || '',
          size_category: teamData.size_category || 'startup',
          website_url: teamData.website_url || '',
          settings: teamData.settings || {},
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        // Store the mock team
        this.mockTeams.push(mockTeam)
        return { success: true, team: mockTeam }
      }

      // Generate unique slug
      const { data: slugData, error: slugError } = await this.supabaseAdmin
        .rpc('generate_team_slug', { team_name: teamData.name });

      if (slugError) throw slugError;

      const slug = slugData || teamData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Create team
      const { data: team, error: teamError } = await this.supabaseAdmin
        .from('teams')
        .insert({
          name: teamData.name,
          slug,
          description: teamData.description,
          industry: teamData.industry,
          size_category: teamData.size_category,
          website_url: teamData.website_url,
          settings: teamData.settings || {},
          created_by: userId
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Add creator as team owner
      const { error: memberError } = await this.supabaseAdmin
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          role: TeamRole.OWNER,
          status: TeamMemberStatus.ACTIVE
        });

      if (memberError) throw memberError;

      // Log team creation
      await logActivity(
        userId,
        'team_created',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: team.id,
          details: { teamName: teamData.name, slug },
          request
        }
      );

      return { success: true, team };

    } catch (error: any) {
      console.error('Error creating team:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team by ID or slug
   */
  async getTeam(identifier: string): Promise<{ success: boolean; team?: Team; error?: string }> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
      
      const query = isUuid 
        ? this.supabaseAdmin.from('teams').select('*').eq('id', identifier)
        : this.supabaseAdmin.from('teams').select('*').eq('slug', identifier);

      const { data: team, error } = await query.single();

      if (error) throw error;

      return { success: true, team };

    } catch (error: any) {
      console.error('Error getting team:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update team
   */
  async updateTeam(
    teamId: string,
    userId: string,
    updateData: UpdateTeamRequest,
    request?: NextRequest
  ): Promise<{ success: boolean; team?: Team; error?: string }> {
    try {
      // Check if user has permission to update team
      const hasPermission = await this.checkTeamPermission(teamId, userId, 'canManageSettings');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Update team
      const { data: team, error } = await this.supabaseAdmin
        .from('teams')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', teamId)
        .select()
        .single();

      if (error) throw error;

      // Log team update
      await logActivity(
        userId,
        'team_updated',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: teamId,
          details: updateData,
          request
        }
      );

      return { success: true, team };

    } catch (error: any) {
      console.error('Error updating team:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete team
   */
  async deleteTeam(
    teamId: string,
    userId: string,
    request?: NextRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user has permission to delete team
      const hasPermission = await this.checkTeamPermission(teamId, userId, 'canDeleteTeam');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Delete team (cascade will handle related records)
      const { error } = await this.supabaseAdmin
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      // Log team deletion
      await logActivity(
        userId,
        'team_deleted',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.WARNING,
        {
          resourceType: 'team',
          resourceId: teamId,
          request
        }
      );

      return { success: true };

    } catch (error: any) {
      console.error('Error deleting team:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Team Member Management
  // ========================================

  /**
   * Get team members
   */
  async getTeamMembers(
    teamId: string,
    filters: TeamMemberFilters = {}
  ): Promise<{ success: boolean; members?: TeamMember[]; error?: string }> {
    try {
      let query = this.supabaseAdmin
        .from('team_members')
        .select(`
          *,
          user:user_profiles!team_members_user_id_fkey(display_name, avatar_url, email)
        `)
        .eq('team_id', teamId);

      // Apply filters
      if (filters.role) query = query.eq('role', filters.role);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.joined_after) query = query.gte('joined_at', filters.joined_after);
      if (filters.joined_before) query = query.lte('joined_at', filters.joined_before);

      const { data: members, error } = await query.order('joined_at', { ascending: false });

      if (error) throw error;

      return { success: true, members };

    } catch (error: any) {
      console.error('Error getting team members:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Invite member to team
   */
  async inviteMember(
    teamId: string,
    inviterId: string,
    invitationData: InviteMemberRequest,
    request?: NextRequest
  ): Promise<{ success: boolean; invitation?: TeamInvitation; error?: string }> {
    try {
      // Check if user has permission to invite members
      const hasPermission = await this.checkTeamPermission(teamId, inviterId, 'canInviteMembers');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Generate invitation token
      const invitationToken = crypto.randomUUID();

      // Set expiration (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation
      const { data: invitation, error } = await this.supabaseAdmin
        .from('team_invitations')
        .insert({
          team_id: teamId,
          email: invitationData.email,
          role: invitationData.role,
          permissions: invitationData.permissions || {},
          invited_by: inviterId,
          invitation_token: invitationToken,
          expires_at: expiresAt.toISOString(),
          message: invitationData.message
        })
        .select(`
          *,
          team:teams(name, slug),
          inviter:user_profiles!team_invitations_invited_by_fkey(display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Log invitation
      await logActivity(
        inviterId,
        'member_invited',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: teamId,
          details: { 
            email: invitationData.email, 
            role: invitationData.role,
            invitationId: invitation.id 
          },
          request
        }
      );

      return { success: true, invitation };

    } catch (error: any) {
      console.error('Error inviting member:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(
    invitationToken: string,
    userId: string,
    request?: NextRequest
  ): Promise<{ success: boolean; team?: Team; error?: string }> {
    try {
      // Get invitation
      const { data: invitation, error: inviteError } = await this.supabaseAdmin
        .from('team_invitations')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('invitation_token', invitationToken)
        .single();

      if (inviteError) throw inviteError;

      if (invitation.status !== InvitationStatus.PENDING) {
        return { success: false, error: 'Invitation is not pending' };
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return { success: false, error: 'Invitation has expired' };
      }

      // Add user to team
      const { error: memberError } = await this.supabaseAdmin
        .from('team_members')
        .insert({
          team_id: invitation.team_id,
          user_id: userId,
          role: invitation.role,
          permissions: invitation.permissions,
          status: TeamMemberStatus.ACTIVE,
          invited_by: invitation.invited_by
        });

      if (memberError) throw memberError;

      // Update invitation status
      const { error: updateError } = await this.supabaseAdmin
        .from('team_invitations')
        .update({
          status: InvitationStatus.ACCEPTED,
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // Log acceptance
      await logActivity(
        userId,
        'invitation_accepted',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: invitation.team_id,
          details: { invitationId: invitation.id, role: invitation.role },
          request
        }
      );

      return { success: true, team: invitation.team };

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    teamId: string,
    targetUserId: string,
    updaterId: string,
    roleData: UpdateMemberRoleRequest,
    request?: NextRequest
  ): Promise<{ success: boolean; member?: TeamMember; error?: string }> {
    try {
      // Check if user has permission to manage roles
      const hasPermission = await this.checkTeamPermission(teamId, updaterId, 'canManageRoles');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Update member role
      const { data: member, error } = await this.supabaseAdmin
        .from('team_members')
        .update({
          role: roleData.role,
          permissions: roleData.permissions || {}
        })
        .eq('team_id', teamId)
        .eq('user_id', targetUserId)
        .select(`
          *,
          user:user_profiles!team_members_user_id_fkey(display_name, avatar_url, email)
        `)
        .single();

      if (error) throw error;

      // Log role update
      await logActivity(
        updaterId,
        'member_role_updated',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: teamId,
          details: { 
            targetUserId, 
            newRole: roleData.role,
            memberId: member.id 
          },
          request
        }
      );

      return { success: true, member };

    } catch (error: any) {
      console.error('Error updating member role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove member from team
   */
  async removeMember(
    teamId: string,
    targetUserId: string,
    removerId: string,
    request?: NextRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user has permission to remove members
      const hasPermission = await this.checkTeamPermission(teamId, removerId, 'canRemoveMembers');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Remove member
      const { error } = await this.supabaseAdmin
        .from('team_members')
        .update({ status: TeamMemberStatus.LEFT })
        .eq('team_id', teamId)
        .eq('user_id', targetUserId);

      if (error) throw error;

      // Log removal
      await logActivity(
        removerId,
        'member_removed',
        ActivityCategory.USER_MANAGEMENT,
        ActivityLevel.WARNING,
        {
          resourceType: 'team',
          resourceId: teamId,
          details: { targetUserId },
          request
        }
      );

      return { success: true };

    } catch (error: any) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Content Sharing
  // ========================================

  /**
   * Share content with team
   */
  async shareContent(
    teamId: string,
    sharerId: string,
    contentData: ShareContentRequest,
    request?: NextRequest
  ): Promise<{ success: boolean; sharing?: TeamContentSharing; error?: string }> {
    try {
      // Check if user has permission to share content
      const hasPermission = await this.checkTeamPermission(teamId, sharerId, 'canShareContent');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Create content sharing record
      const { data: sharing, error } = await this.supabaseAdmin
        .from('team_content_sharing')
        .insert({
          team_id: teamId,
          content_type: contentData.content_type,
          content_id: contentData.content_id,
          shared_by: sharerId,
          permissions: contentData.permissions || {},
          is_public: contentData.is_public || false,
          expires_at: contentData.expires_at
        })
        .select(`
          *,
          sharer:user_profiles!team_content_sharing_shared_by_fkey(display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Log content sharing
      await logActivity(
        sharerId,
        'content_shared',
        ActivityCategory.CONTENT_MANAGEMENT,
        ActivityLevel.INFO,
        {
          resourceType: 'team',
          resourceId: teamId,
          details: { 
            contentType: contentData.content_type,
            contentId: contentData.content_id,
            isPublic: contentData.is_public 
          },
          request
        }
      );

      return { success: true, sharing };

    } catch (error: any) {
      console.error('Error sharing content:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get team shared content
   */
  async getTeamSharedContent(
    teamId: string,
    contentType?: ContentType
  ): Promise<{ success: boolean; content?: TeamContentSharing[]; error?: string }> {
    try {
      let query = this.supabaseAdmin
        .from('team_content_sharing')
        .select(`
          *,
          sharer:user_profiles!team_content_sharing_shared_by_fkey(display_name, avatar_url)
        `)
        .eq('team_id', teamId);

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      const { data: content, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, content };

    } catch (error: any) {
      console.error('Error getting team shared content:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Team Statistics
  // ========================================

  /**
   * Get team statistics
   */
  async getTeamStats(teamId: string): Promise<{ success: boolean; stats?: TeamStats; error?: string }> {
    try {
      // Get member count
      const { count: memberCount } = await this.supabaseAdmin
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', TeamMemberStatus.ACTIVE);

      // Get pending invitations count
      const { count: pendingInvitations } = await this.supabaseAdmin
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', InvitationStatus.PENDING);

      // Get shared content count
      const { count: contentShared } = await this.supabaseAdmin
        .from('team_content_sharing')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      // Get workspaces count
      const { count: workspacesCount } = await this.supabaseAdmin
        .from('team_workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      // Get activity count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: activityCount } = await this.supabaseAdmin
        .from('team_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get last activity
      const { data: lastActivity } = await this.supabaseAdmin
        .from('team_activity_logs')
        .select('created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const stats: TeamStats = {
        member_count: memberCount || 0,
        active_members: memberCount || 0,
        pending_invitations: pendingInvitations || 0,
        content_shared: contentShared || 0,
        workspaces_count: workspacesCount || 0,
        activity_count: activityCount || 0,
        last_activity: lastActivity?.created_at
      };

      return { success: true, stats };

    } catch (error: any) {
      console.error('Error getting team stats:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Permission Checking
  // ========================================

  /**
   * Check if user has specific team permission
   */
  async checkTeamPermission(
    teamId: string,
    userId: string,
    permission: keyof TeamPermissions
  ): Promise<boolean> {
    try {
      // Get user's role in team
      const { data: member, error } = await this.supabaseAdmin
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', TeamMemberStatus.ACTIVE)
        .single();

      if (error || !member) return false;

      // Check permission based on role
      const rolePermissions = TEAM_ROLE_PERMISSIONS[member.role as TeamRole];
      return rolePermissions[permission] || false;

    } catch (error) {
      console.error('Error checking team permission:', error);
      return false;
    }
  }

  /**
   * Get user's permissions for a team
   */
  async getUserTeamPermissions(
    teamId: string,
    userId: string
  ): Promise<{ success: boolean; permissions?: TeamPermissions; role?: TeamRole; error?: string }> {
    try {
      const { data: member, error } = await this.supabaseAdmin
        .from('team_members')
        .select('role, permissions')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', TeamMemberStatus.ACTIVE)
        .single();

      if (error || !member) {
        return { success: false, error: 'User is not a member of this team' };
      }

      const rolePermissions = TEAM_ROLE_PERMISSIONS[member.role as TeamRole];
      return { 
        success: true, 
        permissions: rolePermissions,
        role: member.role as TeamRole
      };

    } catch (error: any) {
      console.error('Error getting user team permissions:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // User Teams
  // ========================================

  /**
   * Get user's teams
   */
  async getUserTeams(userId: string): Promise<{ success: boolean; teams?: Team[]; error?: string }> {
    try {
      // Handle development mode
      if (isDevMode()) {
        // console.log('🚀 Getting mock teams in development mode')
        // Return teams created by this user
        const userTeams = this.mockTeams.filter(team => team.created_by === userId)
        return { success: true, teams: userTeams }
      }

      const { data: teams, error } = await this.supabaseAdmin
        .from('team_members')
        .select(`
          team:teams(*)
        `)
        .eq('user_id', userId)
        .eq('status', TeamMemberStatus.ACTIVE);

      if (error) throw error;

      const userTeams = teams?.map(t => t.team).filter(Boolean) || [];
      return { success: true, teams: userTeams };

    } catch (error: any) {
      console.error('Error getting user teams:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's pending invitations
   */
  async getUserInvitations(email: string): Promise<{ success: boolean; invitations?: TeamInvitation[]; error?: string }> {
    try {
      const { data: invitations, error } = await this.supabaseAdmin
        .from('team_invitations')
        .select(`
          *,
          team:teams(name, slug, avatar_url),
          inviter:user_profiles!team_invitations_invited_by_fkey(display_name, avatar_url)
        `)
        .eq('email', email)
        .eq('status', InvitationStatus.PENDING)
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      return { success: true, invitations };

    } catch (error: any) {
      console.error('Error getting user invitations:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const teamService = TeamService.getInstance();
