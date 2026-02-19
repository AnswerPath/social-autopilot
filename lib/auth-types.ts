import { User } from '@supabase/supabase-js'

// User roles for role-based access control
export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

// Permissions for granular access control
export enum Permission {
  // Post management
  CREATE_POST = 'create_post',
  EDIT_POST = 'edit_post',
  DELETE_POST = 'delete_post',
  PUBLISH_POST = 'publish_post',
  APPROVE_POST = 'approve_post',
  SCHEDULE_POST = 'schedule_post',
  VIEW_POST = 'view_post',
  EDIT_OWN_POST = 'edit_own_post',
  DELETE_OWN_POST = 'delete_own_post',
  APPROVE_OWN_POST = 'approve_own_post',
  
  // Content management
  UPLOAD_MEDIA = 'upload_media',
  DELETE_MEDIA = 'delete_media',
  MANAGE_CONTENT = 'manage_content',
  EDIT_MEDIA = 'edit_media',
  VIEW_MEDIA = 'view_media',
  
  // Analytics and reporting
  VIEW_ANALYTICS = 'view_analytics',
  EXPORT_DATA = 'export_data',
  VIEW_ENGAGEMENT_METRICS = 'view_engagement_metrics',
  VIEW_PERFORMANCE_REPORTS = 'view_performance_reports',
  VIEW_OWN_ANALYTICS = 'view_own_analytics',
  EXPORT_OWN_DATA = 'export_own_data',
  
  // User management
  MANAGE_USERS = 'manage_users',
  ASSIGN_ROLES = 'assign_roles',
  VIEW_USERS = 'view_users',
  DEACTIVATE_USERS = 'deactivate_users',
  EDIT_USER_PROFILES = 'edit_user_profiles',
  VIEW_USER_PROFILES = 'view_user_profiles',
  
  // Settings and configuration
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_INTEGRATIONS = 'manage_integrations',
  VIEW_SYSTEM_LOGS = 'view_system_logs',
  MANAGE_APP_SETTINGS = 'manage_app_settings',
  VIEW_APP_SETTINGS = 'view_app_settings',
  
  // Team management
  MANAGE_TEAMS = 'manage_teams',
  ASSIGN_TO_TEAMS = 'assign_to_teams',
  INVITE_MEMBERS = 'invite_members',
  REMOVE_MEMBERS = 'remove_members',
  VIEW_TEAM_MEMBERS = 'view_team_members',
  MANAGE_TEAM_SETTINGS = 'manage_team_settings',
  
  // Automation
  MANAGE_AUTOMATION = 'manage_automation',
  CREATE_AUTO_REPLIES = 'create_auto_replies',
  MANAGE_SCHEDULING = 'manage_scheduling',
  VIEW_AUTOMATION = 'view_automation',
  EDIT_AUTOMATION = 'edit_automation',
  
  // Billing and subscription
  VIEW_BILLING = 'view_billing',
  MANAGE_SUBSCRIPTION = 'manage_subscription',
  VIEW_BILLING_HISTORY = 'view_billing_history',
  MANAGE_PAYMENT_METHODS = 'manage_payment_methods',
  
  // API access
  ACCESS_API = 'access_api',
  MANAGE_API_KEYS = 'manage_api_keys',
  CREATE_API_KEYS = 'create_api_keys',
  REVOKE_API_KEYS = 'revoke_api_keys',
  
  // Granular permissions
  MANAGE_OWN_PROFILE = 'manage_own_profile',
  VIEW_OWN_PROFILE = 'view_own_profile',
  MANAGE_OWN_SESSIONS = 'manage_own_sessions',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_PERMISSIONS = 'manage_permissions'
}

// Permission mapping for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Post management - full access
    Permission.CREATE_POST,
    Permission.EDIT_POST,
    Permission.DELETE_POST,
    Permission.PUBLISH_POST,
    Permission.APPROVE_POST,
    Permission.SCHEDULE_POST,
    Permission.VIEW_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_OWN_POST,
    Permission.APPROVE_OWN_POST,
    
    // Content management - full access
    Permission.UPLOAD_MEDIA,
    Permission.DELETE_MEDIA,
    Permission.MANAGE_CONTENT,
    Permission.EDIT_MEDIA,
    Permission.VIEW_MEDIA,
    
    // Analytics and reporting - full access
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_ENGAGEMENT_METRICS,
    Permission.VIEW_PERFORMANCE_REPORTS,
    Permission.VIEW_OWN_ANALYTICS,
    Permission.EXPORT_OWN_DATA,
    
    // User management - full access
    Permission.MANAGE_USERS,
    Permission.ASSIGN_ROLES,
    Permission.VIEW_USERS,
    Permission.DEACTIVATE_USERS,
    Permission.EDIT_USER_PROFILES,
    Permission.VIEW_USER_PROFILES,
    
    // Settings and configuration - full access
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_INTEGRATIONS,
    Permission.VIEW_SYSTEM_LOGS,
    Permission.MANAGE_APP_SETTINGS,
    Permission.VIEW_APP_SETTINGS,
    
    // Team management - full access
    Permission.MANAGE_TEAMS,
    Permission.ASSIGN_TO_TEAMS,
    Permission.INVITE_MEMBERS,
    Permission.REMOVE_MEMBERS,
    Permission.VIEW_TEAM_MEMBERS,
    Permission.MANAGE_TEAM_SETTINGS,
    
    // Automation - full access
    Permission.MANAGE_AUTOMATION,
    Permission.CREATE_AUTO_REPLIES,
    Permission.MANAGE_SCHEDULING,
    Permission.VIEW_AUTOMATION,
    Permission.EDIT_AUTOMATION,
    
    // Billing and subscription - full access
    Permission.VIEW_BILLING,
    Permission.MANAGE_SUBSCRIPTION,
    Permission.VIEW_BILLING_HISTORY,
    Permission.MANAGE_PAYMENT_METHODS,
    
    // API access - full access
    Permission.ACCESS_API,
    Permission.MANAGE_API_KEYS,
    Permission.CREATE_API_KEYS,
    Permission.REVOKE_API_KEYS,
    
    // Granular permissions - full access
    Permission.MANAGE_OWN_PROFILE,
    Permission.VIEW_OWN_PROFILE,
    Permission.MANAGE_OWN_SESSIONS,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_PERMISSIONS
  ],
  [UserRole.EDITOR]: [
    // Post management - create and edit, but no approval of others
    Permission.CREATE_POST,
    Permission.EDIT_POST,
    Permission.EDIT_OWN_POST,
    Permission.DELETE_OWN_POST,
    Permission.SCHEDULE_POST,
    Permission.VIEW_POST,
    Permission.APPROVE_OWN_POST,
    
    // Content management - upload and manage content
    Permission.UPLOAD_MEDIA,
    Permission.MANAGE_CONTENT,
    Permission.EDIT_MEDIA,
    Permission.VIEW_MEDIA,
    
    // Analytics and reporting - view and export
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.VIEW_ENGAGEMENT_METRICS,
    Permission.VIEW_PERFORMANCE_REPORTS,
    Permission.VIEW_OWN_ANALYTICS,
    Permission.EXPORT_OWN_DATA,
    
    // User management - view only
    Permission.VIEW_USERS,
    Permission.VIEW_USER_PROFILES,
    
    // Team management - view team assignments
    Permission.ASSIGN_TO_TEAMS,
    Permission.VIEW_TEAM_MEMBERS,
    
    // Automation - create auto replies
    Permission.CREATE_AUTO_REPLIES,
    Permission.VIEW_AUTOMATION,
    Permission.EDIT_AUTOMATION,
    
    // API access - basic access
    Permission.ACCESS_API,
    Permission.CREATE_API_KEYS,
    
    // Granular permissions - own profile
    Permission.MANAGE_OWN_PROFILE,
    Permission.VIEW_OWN_PROFILE,
    Permission.MANAGE_OWN_SESSIONS
  ],
  [UserRole.VIEWER]: [
    // Post management - view only
    Permission.VIEW_POST,
    
    // Content management - view only
    Permission.VIEW_MEDIA,
    
    // Analytics and reporting - view only
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_ENGAGEMENT_METRICS,
    Permission.VIEW_PERFORMANCE_REPORTS,
    Permission.VIEW_OWN_ANALYTICS,
    
    // User management - view only
    Permission.VIEW_USERS,
    Permission.VIEW_USER_PROFILES,
    
    // Team management - view team assignments
    Permission.ASSIGN_TO_TEAMS,
    Permission.VIEW_TEAM_MEMBERS,
    
    // Automation - view only
    Permission.VIEW_AUTOMATION,
    
    // API access - read only
    Permission.ACCESS_API,
    
    // Granular permissions - own profile
    Permission.VIEW_OWN_PROFILE,
    Permission.MANAGE_OWN_SESSIONS
  ]
}

// Resource-based permission types
export interface ResourcePermission {
  id: string;
  permission: Permission;
  resource_type: string;
  resource_id: string;
  user_id: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  conditions?: PermissionCondition[];
  is_active: boolean;
}

export interface PermissionCondition {
  type: 'time' | 'location' | 'device' | 'ip' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface CustomPermission {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  resource_types?: string[];
  conditions?: PermissionCondition[];
  is_system: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionOverride {
  id: string;
  user_id: string;
  permission: Permission;
  action: 'grant' | 'deny';
  resource_type?: string;
  resource_id?: string;
  reason: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
}

export interface PermissionContext {
  user: AuthUser;
  resource_type?: string;
  resource_id?: string;
  action?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
  ip_address?: string;
  user_agent?: string;
}

// Extended user interface with role and permissions
export interface AuthUser extends User {
  role: UserRole
  permissions: Permission[]
  custom_permissions?: CustomPermission[]
  permission_overrides?: PermissionOverride[]
  resource_permissions?: ResourcePermission[]
  team_id?: string
  profile?: UserProfile
}

// User profile information
export interface UserProfile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  timezone?: string
  email_notifications: boolean
  created_at: string
  updated_at: string
}

// Account Settings Types
export type DigestFrequency = 'immediate' | 'daily' | 'weekly';

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  sms_notifications: boolean;
  /** Phone number for SMS notifications (E.164). Required when sms_notifications is true. */
  phone_number?: string | null;
  mention_notifications: boolean;
  post_approval_notifications: boolean;
  analytics_notifications: boolean;
  security_notifications: boolean;
  marketing_emails: boolean;
  weekly_digest: boolean;
  daily_summary: boolean;
  /** When to receive non-urgent notifications: immediate, daily digest, or weekly digest */
  digest_frequency?: DigestFrequency;
}

export interface SecuritySettings {
  two_factor_enabled: boolean;
  login_notifications: boolean;
  session_timeout_minutes: number;
  require_password_for_sensitive_actions: boolean;
  last_password_change?: string;
  failed_login_attempts: number;
  account_locked_until?: string;
}

export interface AccountPreferences {
  language: string;
  timezone: string;
  date_format: string;
  time_format: '12h' | '24h';
  theme: 'light' | 'dark' | 'system';
  compact_mode: boolean;
  auto_save_drafts: boolean;
  default_post_visibility: 'public' | 'private' | 'team';
}

export interface AccountSettings {
  id: string;
  user_id: string;
  notification_preferences: NotificationPreferences;
  security_settings: SecuritySettings;
  account_preferences: AccountPreferences;
  created_at: string;
  updated_at: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface AccountDeletionRequest {
  password: string;
  reason?: string;
  feedback?: string;
}

export interface SessionInfo {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_activity: string;
  is_current: boolean;
  location?: string;
}

// Session information
export interface AuthSession {
  user: AuthUser
  access_token: string
  refresh_token: string
  expires_at: number
}

// Authentication state for client-side
export interface AuthState {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  error: string | null
}

// Login request payload
export interface LoginRequest {
  email: string
  password: string
}

// Registration request payload
export interface RegisterRequest {
  email: string
  password: string
  first_name?: string
  last_name?: string
  display_name?: string
}

// Password reset request
export interface PasswordResetRequest {
  email: string
}

// Password update request
export interface PasswordUpdateRequest {
  current_password: string
  new_password: string
}

// Role update request
export interface RoleUpdateRequest {
  user_id: string
  role: UserRole
}

// Team assignment request
export interface TeamAssignmentRequest {
  user_id: string
  team_id: string
}

// Permission check result
export interface PermissionCheck {
  hasPermission: boolean
  requiredPermission: Permission
  userRole: UserRole
  userPermissions: Permission[]
  resourceId?: string
  context?: Record<string, any>
}

// Resource-based permission check
export interface ResourcePermissionCheck extends PermissionCheck {
  resourceType: string
  resourceId: string
  resourceOwner?: string
}

// Permission matrix for detailed role-permission mapping
export interface PermissionMatrix {
  role: UserRole
  permissions: Permission[]
  description: string
  restrictions?: string[]
}

// Permission audit log entry
export interface PermissionAuditEntry {
  id: string
  user_id: string
  action: 'permission_check' | 'permission_granted' | 'permission_denied' | 'role_changed'
  permission?: Permission
  resource_type?: string
  resource_id?: string
  result: 'allowed' | 'denied'
  reason?: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Audit log entry
export interface AuditLogEntry {
  id: string
  user_id: string
  action: string
  resource_type: string
  resource_id?: string
  details?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// Authentication error types
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  ACCOUNT_DISABLED = 'account_disabled',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  SESSION_EXPIRED = 'session_expired',
  TOKEN_INVALID = 'token_invalid',
  RATE_LIMITED = 'rate_limited',
  NETWORK_ERROR = 'network_error'
}

// Authentication error interface
export interface AuthError {
  type: AuthErrorType
  message: string
  code?: string
  details?: Record<string, any>
}
