import { createSupabaseServiceRoleClient } from '@/lib/supabase';
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
import { buildTeamInviteUrl, sendTeamInvitationEmail } from '@/lib/team-invite-email';

/** Shown in API responses when Resend skips or rejects a send (details stay in server logs). */
export const TEAM_INVITE_EMAIL_CLIENT_ERROR =
  'Email could not be sent. The invitation was saved; check Resend configuration and server logs.';

export class TeamService {
  private static instance: TeamService;
  /** Fresh service-role client so reads/writes are not affected by a poisoned singleton (user JWT on admin client). */
  private serviceDb() {
    return createSupabaseServiceRoleClient();
  }
  private mockTeams: Team[] = []; // Store mock teams in development mode
  private mockInvitations: TeamInvitation[] = []; // Store mock invitations in development mode

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
      const { data: slugData, error: slugError } = await this.serviceDb()
        .rpc('generate_team_slug', { team_name: teamData.name });

      if (slugError) throw slugError;

      const slug = slugData || teamData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // Create team
      const { data: team, error: teamError } = await this.serviceDb()
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
      const { error: memberError } = await this.serviceDb()
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
        ? this.serviceDb().from('teams').select('*').eq('id', identifier)
        : this.serviceDb().from('teams').select('*').eq('slug', identifier);

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
      const { data: team, error } = await this.serviceDb()
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
      const { error } = await this.serviceDb()
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
      // Handle development mode
      if (isDevMode()) {
        console.log('🔧 Development mode: Returning mock team members for team', teamId);
        // Return mock member (the creator)
        const mockTeam = this.mockTeams.find(t => t.id === teamId);
        if (mockTeam) {
          const mockMember: TeamMember = {
            id: `member-${Date.now()}`,
            team_id: teamId,
            user_id: mockTeam.created_by,
            role: TeamRole.OWNER,
            permissions: {},
            status: TeamMemberStatus.ACTIVE,
            joined_at: mockTeam.created_at
          };
          return { success: true, members: [mockMember] };
        }
        return { success: true, members: [] };
      }

      let query = this.serviceDb()
        .from('team_members')
        .select('*')
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
  ): Promise<{
    success: boolean;
    invitation?: TeamInvitation;
    error?: string;
    emailSent?: boolean;
    emailError?: string;
  }> {
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
      const { data: invitation, error } = await this.serviceDb()
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
          team:teams(name, slug)
        `)
        .single();

      if (error) {
        const isUniqueViolation =
          error.code === '23505' ||
          (typeof error.message === 'string' && error.message.includes('duplicate key'));
        if (isUniqueViolation) {
          return this.rotatePendingInvitationAndNotify(
            teamId,
            inviterId,
            invitationData,
            request
          );
        }
        throw error;
      }

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

      const { sent: emailSent } = await this.sendTeamInvitationNotification(
        invitation as TeamInvitation & { team?: Team },
        inviterId
      );

      return {
        success: true,
        invitation,
        emailSent,
        ...(emailSent ? {} : { emailError: TEAM_INVITE_EMAIL_CLIENT_ERROR })
      };

    } catch (error: any) {
      console.error('Error inviting member:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invite email (does not throw; logs provider message on failure).
   */
  private async sendTeamInvitationNotification(
    invitation: TeamInvitation & { team?: Team },
    inviterId: string
  ): Promise<{ sent: boolean }> {
    const teamName = invitation.team?.name ?? 'your team';
    const { data: inviterProfile } = await this.serviceDb()
      .from('user_profiles')
      .select('first_name, last_name, display_name')
      .eq('user_id', inviterId)
      .maybeSingle();
    const inviterLabel =
      inviterProfile?.display_name ||
      [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(' ').trim() ||
      undefined;
    const inviteUrl = buildTeamInviteUrl(invitation.invitation_token);
    const result = await sendTeamInvitationEmail({
      to: invitation.email,
      teamName,
      role: invitation.role,
      inviterLabel,
      message: invitation.message,
      expiresAt: new Date(invitation.expires_at),
      inviteUrl
    });
    if (!result.success) {
      console.error('[team-invite] Email send failed', { error: result.error });
      return { sent: false };
    }
    return { sent: true };
  }

  /**
   * Same email invited again: rotate token for pending row and resend email.
   */
  private async rotatePendingInvitationAndNotify(
    teamId: string,
    inviterId: string,
    invitationData: InviteMemberRequest,
    request?: NextRequest,
    invitationId?: string
  ): Promise<{
    success: boolean;
    invitation?: TeamInvitation;
    error?: string;
    emailSent?: boolean;
    emailError?: string;
  }> {
    let query = this.serviceDb()
      .from('team_invitations')
      .select(`
        *,
        team:teams(name, slug)
      `)
      .eq('team_id', teamId);

    if (invitationId) {
      query = query.eq('id', invitationId);
    } else {
      query = query.eq('email', invitationData.email);
    }

    const { data: existing, error: fetchError } = await query.maybeSingle();

    if (fetchError || !existing) {
      return { success: false, error: fetchError?.message || 'Invitation not found' };
    }

    if (existing.status !== InvitationStatus.PENDING) {
      return {
        success: false,
        error: 'This email already has an invitation or is already on the team.'
      };
    }

    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invitation, error: updateError } = await this.serviceDb()
      .from('team_invitations')
      .update({
        invitation_token: newToken,
        expires_at: expiresAt.toISOString(),
        role: invitationData.role,
        permissions: invitationData.permissions || {},
        invited_by: inviterId,
        message: invitationData.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select(`
        *,
        team:teams(name, slug)
      `)
      .single();

    if (updateError || !invitation) {
      return { success: false, error: updateError?.message || 'Failed to refresh invitation' };
    }

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
          invitationId: invitation.id,
          resent: true
        },
        request
      }
    );

    const { sent: emailSent } = await this.sendTeamInvitationNotification(
      invitation as TeamInvitation & { team?: Team },
      inviterId
    );

    return {
      success: true,
      invitation,
      emailSent,
      ...(emailSent ? {} : { emailError: TEAM_INVITE_EMAIL_CLIENT_ERROR })
    };
  }

  /**
   * Resend email for a pending invitation (rotates token and extends expiry).
   */
  async resendTeamInvitation(
    teamId: string,
    inviterId: string,
    invitationId: string,
    request?: NextRequest
  ): Promise<{
    success: boolean;
    invitation?: TeamInvitation;
    error?: string;
    emailSent?: boolean;
    emailError?: string;
  }> {
    const hasPermission = await this.checkTeamPermission(teamId, inviterId, 'canInviteMembers');
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const { data: existing, error: fetchError } = await this.serviceDb()
      .from('team_invitations')
      .select('id, team_id, email, role, permissions, message, status')
      .eq('id', invitationId)
      .eq('team_id', teamId)
      .maybeSingle();

    if (fetchError || !existing) {
      return { success: false, error: 'Invitation not found' };
    }

    if (existing.status !== InvitationStatus.PENDING) {
      return { success: false, error: 'Only pending invitations can be resent.' };
    }

    const invitationData: InviteMemberRequest = {
      email: existing.email,
      role: existing.role as TeamRole,
      permissions: existing.permissions || {},
      message: existing.message
    };

    return this.rotatePendingInvitationAndNotify(
      teamId,
      inviterId,
      invitationData,
      request,
      existing.id
    );
  }

  /**
   * Pending invitations sent for a team (for admins to resend or review).
   */
  async getPendingInvitationsForTeam(
    teamId: string,
    requesterId: string
  ): Promise<{ success: boolean; invitations?: TeamInvitation[]; error?: string }> {
    try {
      const hasPermission = await this.checkTeamPermission(teamId, requesterId, 'canInviteMembers');
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      const { data: invitations, error } = await this.serviceDb()
        .from('team_invitations')
        .select(`
          *,
          team:teams(name, slug)
        `)
        .eq('team_id', teamId)
        .eq('status', InvitationStatus.PENDING)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, invitations: invitations || [] };
    } catch (error: any) {
      console.error('Error listing team invitations:', error);
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
      const { data: invitation, error: inviteError } = await this.serviceDb()
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

      const { data: authUser, error: authLookupError } = await this.serviceDb().auth.admin.getUserById(userId);
      if (authLookupError || !authUser?.user?.email) {
        return { success: false, error: 'Could not verify authenticated user email' };
      }
      const userEmail = authUser.user.email.trim().toLowerCase();
      const inviteEmail = String(invitation.email).trim().toLowerCase();
      if (userEmail !== inviteEmail) {
        return { success: false, error: 'Invitation email does not match authenticated user' };
      }

      // Add user to team
      const { error: memberError } = await this.serviceDb()
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
      const { error: updateError } = await this.serviceDb()
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
      const { data: member, error } = await this.serviceDb()
        .from('team_members')
        .update({
          role: roleData.role,
          permissions: roleData.permissions || {}
        })
        .eq('team_id', teamId)
        .eq('user_id', targetUserId)
        .select('*')
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
      const { error } = await this.serviceDb()
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
      const { data: sharing, error } = await this.serviceDb()
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
        .select('*')
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
      let query = this.serviceDb()
        .from('team_content_sharing')
        .select('*')
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
      const { count: memberCount } = await this.serviceDb()
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', TeamMemberStatus.ACTIVE);

      // Get pending invitations count
      const { count: pendingInvitations } = await this.serviceDb()
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', InvitationStatus.PENDING);

      // Get shared content count
      const { count: contentShared } = await this.serviceDb()
        .from('team_content_sharing')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      // Get workspaces count
      const { count: workspacesCount } = await this.serviceDb()
        .from('team_workspaces')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId);

      // Get activity count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: activityCount } = await this.serviceDb()
        .from('team_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      // Get last activity
      const { data: lastActivity } = await this.serviceDb()
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
      const { data: member, error } = await this.serviceDb()
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
      const { data: member, error } = await this.serviceDb()
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

      const { data: teams, error } = await this.serviceDb()
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
      // Handle development mode
      if (isDevMode()) {
        console.log('🔧 Development mode: Returning mock invitations');
        return { 
          success: true, 
          invitations: this.mockInvitations.filter(inv => 
            inv.email === email && 
            inv.status === InvitationStatus.PENDING &&
            new Date(inv.expires_at) > new Date()
          ) 
        };
      }

      const { data: invitations, error } = await this.serviceDb()
        .from('team_invitations')
        .select(`
          *,
          team:teams(name, slug, avatar_url)
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
