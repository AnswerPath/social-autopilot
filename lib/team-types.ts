import { User } from '@supabase/supabase-js';

// Team-related enums and types
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

export enum TeamMemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  LEFT = 'left'
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export enum TeamSizeCategory {
  STARTUP = 'startup',
  SMALL = 'small',
  MEDIUM = 'medium',
  ENTERPRISE = 'enterprise'
}

export enum ContentType {
  POST = 'post',
  MEDIA = 'media',
  CAMPAIGN = 'campaign',
  TEMPLATE = 'template',
  ANALYTICS = 'analytics'
}

// Core team interfaces
export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  website_url?: string;
  industry?: string;
  size_category?: TeamSizeCategory;
  billing_email?: string;
  settings: Record<string, any>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  permissions: Record<string, any>;
  joined_at: string;
  invited_by?: string;
  status: TeamMemberStatus;
  last_active_at?: string;
  
  // Extended fields (joined from user_profiles)
  user?: {
    display_name?: string;
    avatar_url?: string;
    email?: string;
  };
}

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  permissions: Record<string, any>;
  invited_by: string;
  invitation_token: string;
  expires_at: string;
  accepted_at?: string;
  status: InvitationStatus;
  message?: string;
  created_at: string;
  updated_at: string;
  
  // Extended fields
  team?: Team;
  inviter?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface TeamContentSharing {
  id: string;
  team_id: string;
  content_type: ContentType;
  content_id: string;
  shared_by: string;
  permissions: Record<string, any>;
  is_public: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  
  // Extended fields
  content?: any; // The actual content object
  sharer?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface TeamActivityLog {
  id: string;
  team_id: string;
  user_id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  
  // Extended fields
  user?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface TeamWorkspace {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  settings: Record<string, any>;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Extended fields
  member_count?: number;
  creator?: {
    display_name?: string;
    avatar_url?: string;
  };
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: TeamRole;
  permissions: Record<string, any>;
  joined_at: string;
  
  // Extended fields
  user?: {
    display_name?: string;
    avatar_url?: string;
    email?: string;
  };
}

// Team permission types
export interface TeamPermissions {
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canManageRoles: boolean;
  canShareContent: boolean;
  canViewAnalytics: boolean;
  canManageWorkspaces: boolean;
  canManageSettings: boolean;
  canDeleteTeam: boolean;
}

// Team role permission mapping
export const TEAM_ROLE_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
  [TeamRole.OWNER]: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canManageRoles: true,
    canShareContent: true,
    canViewAnalytics: true,
    canManageWorkspaces: true,
    canManageSettings: true,
    canDeleteTeam: true,
  },
  [TeamRole.ADMIN]: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canManageRoles: true,
    canShareContent: true,
    canViewAnalytics: true,
    canManageWorkspaces: true,
    canManageSettings: false,
    canDeleteTeam: false,
  },
  [TeamRole.EDITOR]: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canManageRoles: false,
    canShareContent: true,
    canViewAnalytics: true,
    canManageWorkspaces: false,
    canManageSettings: false,
    canDeleteTeam: false,
  },
  [TeamRole.MEMBER]: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canManageRoles: false,
    canShareContent: true,
    canViewAnalytics: false,
    canManageWorkspaces: false,
    canManageSettings: false,
    canDeleteTeam: false,
  },
  [TeamRole.VIEWER]: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canManageRoles: false,
    canShareContent: false,
    canViewAnalytics: false,
    canManageWorkspaces: false,
    canManageSettings: false,
    canDeleteTeam: false,
  },
};

// Team statistics interfaces
export interface TeamStats {
  member_count: number;
  active_members: number;
  pending_invitations: number;
  content_shared: number;
  workspaces_count: number;
  activity_count: number;
  last_activity?: string;
}

export interface TeamActivityStats {
  total_actions: number;
  actions_by_type: Record<string, number>;
  most_active_members: Array<{
    user_id: string;
    display_name?: string;
    action_count: number;
  }>;
  recent_activities: TeamActivityLog[];
}

// Team creation/update interfaces
export interface CreateTeamRequest {
  name: string;
  description?: string;
  industry?: string;
  size_category?: TeamSizeCategory;
  website_url?: string;
  settings?: Record<string, any>;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  industry?: string;
  size_category?: TeamSizeCategory;
  website_url?: string;
  settings?: Record<string, any>;
  is_active?: boolean;
}

export interface InviteMemberRequest {
  email: string;
  role: TeamRole;
  message?: string;
  permissions?: Record<string, any>;
}

export interface UpdateMemberRoleRequest {
  user_id: string;
  role: TeamRole;
  permissions?: Record<string, any>;
}

export interface ShareContentRequest {
  content_type: ContentType;
  content_id: string;
  permissions?: Record<string, any>;
  is_public?: boolean;
  expires_at?: string;
}

// Team search and filtering interfaces
export interface TeamFilters {
  search?: string;
  industry?: string;
  size_category?: TeamSizeCategory;
  is_active?: boolean;
  created_after?: string;
  created_before?: string;
}

export interface TeamMemberFilters {
  role?: TeamRole;
  status?: TeamMemberStatus;
  search?: string;
  joined_after?: string;
  joined_before?: string;
}

// Team workspace interfaces
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Record<string, any>;
}

// Extended user interface with team information
export interface UserWithTeams extends User {
  teams: Team[];
  team_memberships: TeamMember[];
  pending_invitations: TeamInvitation[];
}

// Team context for React components
export interface TeamContext {
  currentTeam: Team | null;
  teamMembers: TeamMember[];
  userRole: TeamRole | null;
  userPermissions: TeamPermissions;
  isLoading: boolean;
  error: string | null;
  switchTeam: (teamId: string) => Promise<void>;
  refreshTeam: () => Promise<void>;
}

// API response types
export interface TeamApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedTeamResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Team invitation email templates
export interface InvitationEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Team collaboration events for real-time updates
export interface TeamEvent {
  type: 'member_joined' | 'member_left' | 'member_role_changed' | 'content_shared' | 'invitation_sent' | 'workspace_created';
  team_id: string;
  user_id: string;
  data: any;
  timestamp: string;
}

// Team billing and subscription (for future use)
export interface TeamSubscription {
  team_id: string;
  plan: string;
  status: 'active' | 'inactive' | 'cancelled';
  current_period_start: string;
  current_period_end: string;
  seats: number;
  used_seats: number;
}

// Team integration settings
export interface TeamIntegrationSettings {
  social_platforms: Record<string, any>;
  analytics_providers: Record<string, any>;
  content_management: Record<string, any>;
  collaboration_tools: Record<string, any>;
}
