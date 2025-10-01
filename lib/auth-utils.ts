import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { 
  AuthUser, 
  UserRole, 
  Permission, 
  ROLE_PERMISSIONS, 
  AuthError, 
  AuthErrorType,
  UserProfile,
  AuditLogEntry,
  PermissionCheck,
  ResourcePermissionCheck,
  PermissionAuditEntry
} from '@/lib/auth-types'
import { getCurrentUserDev, createMockAuthCookies } from '@/lib/auth-dev'

// Cookie names for authentication
const AUTH_COOKIE_NAME = 'sb-auth-token'
const REFRESH_COOKIE_NAME = 'sb-refresh-token'
const SESSION_ID_COOKIE_NAME = 'sb-session-id'

/**
 * Development mode check
 */
export function isDevMode(): boolean {
  // In development, check if we're using placeholder Supabase config
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
  const usingPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                          process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
                          process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')
  
  const isDevModeEnabled = isDevelopment && usingPlaceholder
  // console.log('🔧 Development mode check:', { isDevelopment, usingPlaceholder, isDevModeEnabled, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })
  
  return isDevModeEnabled
}

// Session configuration
const SESSION_CONFIG = {
  accessTokenExpiry: 60 * 60, // 1 hour
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  sessionIdExpiry: 30 * 24 * 60 * 60, // 30 days
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/'
  }
}

// Session storage interface for tracking active sessions
interface SessionInfo {
  session_id: string
  user_id: string
  created_at: string
  last_activity: string
  ip_address: string
  user_agent: string
  is_active: boolean
  expires_at: string
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get the current authenticated user from the request with enhanced session management
 */
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  // Use development mode if Supabase is not properly configured
  if (isDevMode()) {
    return await getCurrentUserDev(request)
  }

  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
    const sessionId = request.cookies.get(SESSION_ID_COOKIE_NAME)?.value
    
    if (!token || !sessionId) {
      return null
    }

    // Verify the token with Supabase
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
    
    if (error || !user) {
      // Token is invalid, clear cookies
      clearAuthCookies()
      return null
    }

    // Check if session is still valid in our database
    const { data: sessionInfo } = await getSupabaseAdmin()
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!sessionInfo) {
      // Session not found or inactive, clear cookies
      clearAuthCookies()
      return null
    }

    // Check if session has expired
    if (new Date(sessionInfo.expires_at) < new Date()) {
      // Session expired, deactivate it and clear cookies
      await deactivateSession(sessionId)
      clearAuthCookies()
      return null
    }

    // Update last activity with enhanced security checks
    try {
      const { updateSessionActivity } = await import('@/lib/session-management')
      const updateResult = await updateSessionActivity(sessionId, request)
      
      // Check for security alerts
      if (updateResult.securityAlert) {
        console.warn('Security alert detected:', updateResult.securityAlert)
        // In production, you might want to send alerts or take additional security measures
      }
    } catch (error) {
      console.error('Error updating session activity:', error)
      // Fallback to basic activity update
      await updateSessionActivity(sessionId)
    }

    // Get user profile and role from database
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Get user role from database (default to VIEWER if not set)
    const { data: roleData } = await getSupabaseAdmin()
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const role = roleData?.role || UserRole.VIEWER
    const permissions = ROLE_PERMISSIONS[role as UserRole]

    return {
      ...user,
      role,
      permissions,
      profile: profile || undefined
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(request: NextRequest): Promise<{ success: boolean; newToken?: string }> {
  try {
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value
    const sessionId = request.cookies.get(SESSION_ID_COOKIE_NAME)?.value
    
    if (!refreshToken || !sessionId) {
      return { success: false }
    }

    // Refresh the token with Supabase
    const { data, error } = await getSupabaseAdmin().auth.refreshSession({
      refresh_token: refreshToken
    })

    if (error || !data.session) {
      // Refresh failed, clear cookies
      clearAuthCookies()
      return { success: false }
    }

    // Update session in database
    await updateSessionTokens(sessionId, data.session.access_token, data.session.refresh_token)

    // Set new cookies
    setAuthCookies(data.session)

    return { success: true, newToken: data.session.access_token }
  } catch (error) {
    console.error('Token refresh error:', error)
    return { success: false }
  }
}

/**
 * Create a new session for a user (enhanced with security checks)
 */
export async function createUserSession(
  userId: string, 
  session: any, 
  request: NextRequest
): Promise<string> {
  // Import the enhanced session management
  const { createEnhancedSession } = await import('@/lib/session-management')
  
  try {
    return await createEnhancedSession(userId, request)
  } catch (error) {
    console.error('Error creating enhanced session, falling back to basic session:', error)
    
    // Fallback to basic session creation
    const sessionId = generateSessionId()
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.sessionIdExpiry * 1000)

    const sessionInfo: Omit<SessionInfo, 'created_at'> = {
      session_id: sessionId,
      user_id: userId,
      last_activity: new Date().toISOString(),
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      is_active: true,
      expires_at: expiresAt.toISOString()
    }

    await getSupabaseAdmin()
      .from('user_sessions')
      .insert(sessionInfo)

    return sessionId
  }
}

/**
 * Update session activity timestamp
 */
async function updateSessionActivity(sessionId: string): Promise<void> {
  await getSupabaseAdmin()
    .from('user_sessions')
    .update({ 
      last_activity: new Date().toISOString() 
    })
    .eq('session_id', sessionId)
}

/**
 * Update session tokens
 */
async function updateSessionTokens(
  sessionId: string, 
  accessToken: string, 
  refreshToken: string
): Promise<void> {
  await getSupabaseAdmin()
    .from('user_sessions')
    .update({ 
      last_activity: new Date().toISOString() 
    })
    .eq('session_id', sessionId)
}

/**
 * Deactivate a session
 */
async function deactivateSession(sessionId: string): Promise<void> {
  await getSupabaseAdmin()
    .from('user_sessions')
    .update({ is_active: false })
    .eq('session_id', sessionId)
}

/**
 * Deactivate all sessions for a user (except current one)
 */
export async function deactivateOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  await getSupabaseAdmin()
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .neq('session_id', currentSessionId)
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const { data } = await getSupabaseAdmin()
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_activity', { ascending: false })

  return data || []
}

/**
 * Set authentication cookies using NextResponse (for API routes)
 */
export function setAuthCookiesResponse(session: any, sessionId?: string): NextResponse {
  const response = NextResponse.json({ success: true })
  
  // Set access token cookie
  response.cookies.set(AUTH_COOKIE_NAME, session.access_token, {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: SESSION_CONFIG.accessTokenExpiry
  })

  // Set refresh token cookie
  response.cookies.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: SESSION_CONFIG.refreshTokenExpiry
  })

  // Set session ID cookie if provided
  if (sessionId) {
    response.cookies.set(SESSION_ID_COOKIE_NAME, sessionId, {
      ...SESSION_CONFIG.cookieOptions,
      maxAge: SESSION_CONFIG.sessionIdExpiry
    })
  }

  return response
}

/**
 * Set authentication cookies (for server actions)
 */
export async function setAuthCookies(session: any, sessionId?: string) {
  const cookieStore = await cookies()
  
  // Set access token cookie
  cookieStore.set(AUTH_COOKIE_NAME, session.access_token, {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: SESSION_CONFIG.accessTokenExpiry
  })

  // Set refresh token cookie
  cookieStore.set(REFRESH_COOKIE_NAME, session.refresh_token, {
    ...SESSION_CONFIG.cookieOptions,
    maxAge: SESSION_CONFIG.refreshTokenExpiry
  })

  // Set session ID cookie if provided
  if (sessionId) {
    cookieStore.set(SESSION_ID_COOKIE_NAME, sessionId, {
      ...SESSION_CONFIG.cookieOptions,
      maxAge: SESSION_CONFIG.sessionIdExpiry
    })
  }
}

/**
 * Clear authentication cookies
 */
export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
  cookieStore.delete(REFRESH_COOKIE_NAME)
  cookieStore.delete(SESSION_ID_COOKIE_NAME)
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false
  return user.permissions.includes(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(user: AuthUser | null, permissions: Permission[]): boolean {
  if (!user) return false
  return permissions.some(permission => user.permissions.includes(permission))
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(user: AuthUser | null, permissions: Permission[]): boolean {
  if (!user) return false
  return permissions.every(permission => user.permissions.includes(permission))
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  if (!user) return false
  return user.role === role
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AuthUser | null): boolean {
  return hasRole(user, UserRole.ADMIN)
}

/**
 * Create a new user profile
 */
export async function createUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
  const { data, error } = await getSupabaseAdmin()
    .from('user_profiles')
    .insert({
      user_id: userId,
      first_name: profile.first_name,
      last_name: profile.last_name,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      timezone: profile.timezone || 'UTC',
      email_notifications: profile.email_notifications ?? true
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`)
  }

  return data
}

/**
 * Assign a role to a user
 */
export async function assignUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('user_roles')
    .upsert({
      user_id: userId,
      role,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`)
  }
}

/**
 * Log an audit event (legacy function - use activity logging service instead)
 * @deprecated Use logActivity from lib/activity-logging.ts instead
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  try {
    // Import the activity logging service
    const { logActivity, ActivityCategory, ActivityLevel } = await import('@/lib/activity-logging');
    
    // Determine category based on resource type and action
    let category = ActivityCategory.SYSTEM_ADMINISTRATION;
    if (resourceType.includes('user') || action.includes('user')) {
      category = ActivityCategory.USER_MANAGEMENT;
    } else if (action.includes('auth') || action.includes('login') || action.includes('logout')) {
      category = ActivityCategory.AUTHENTICATION;
    } else if (action.includes('permission') || action.includes('role')) {
      category = ActivityCategory.AUTHORIZATION;
    } else if (action.includes('security') || action.includes('breach')) {
      category = ActivityCategory.SECURITY;
    }

    // Log using the enhanced activity logging service
    await logActivity(
      userId,
      action,
      category,
      ActivityLevel.INFO,
      {
        resourceType,
        resourceId,
        details,
        request
      }
    );

    // Also log to the legacy audit_logs table for backward compatibility
    const auditEntry: Omit<AuditLogEntry, 'id' | 'created_at'> = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || 'unknown',
      user_agent: request?.headers.get('user-agent') || 'unknown'
    }

    await getSupabaseAdmin()
      .from('audit_logs')
      .insert(auditEntry)
  } catch (error) {
    console.error('Failed to log audit event:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Create authentication error
 */
export function createAuthError(type: AuthErrorType, message: string, details?: Record<string, any>): AuthError {
  return {
    type,
    message,
    details
  }
}

/**
 * Middleware to require authentication with token refresh
 */
export function requireAuth(handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    let user = await getCurrentUser(request)
    
    if (!user) {
      // Try to refresh the token
      const refreshResult = await refreshAccessToken(request)
      if (refreshResult.success) {
        user = await getCurrentUser(request)
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      )
    }

    return handler(request, user)
  }
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: Permission) {
  return (handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) => {
    return requireAuth(async (request: NextRequest, user: AuthUser) => {
      if (!hasPermission(user, permission)) {
        await logAuditEvent(
          user.id,
          'permission_denied',
          'api',
          undefined,
          { required_permission: permission, user_permissions: user.permissions },
          request
        )

        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions') },
          { status: 403 }
        )
      }

      return handler(request, user)
    })
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: UserRole) {
  return (handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>) => {
    return requireAuth(async (request: NextRequest, user: AuthUser) => {
      if (!hasRole(user, role)) {
        await logAuditEvent(
          user.id,
          'role_denied',
          'api',
          undefined,
          { required_role: role, user_role: user.role },
          request
        )

        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Insufficient role') },
          { status: 403 }
        )
      }

      return handler(request, user)
    })
  }
}

/**
 * Check if user has a specific permission with detailed result
 */
export function checkPermission(
  user: AuthUser | null,
  permission: Permission,
  resourceId?: string,
  context?: Record<string, any>
): PermissionCheck {
  if (!user) {
    return {
      hasPermission: false,
      requiredPermission: permission,
      userRole: UserRole.VIEWER,
      userPermissions: [],
      resourceId,
      context
    }
  }

  const hasPermission = user.permissions.includes(permission)
  
  // Log permission check for audit
  logPermissionCheck(user.id, permission, hasPermission, resourceId, context)

  return {
    hasPermission,
    requiredPermission: permission,
    userRole: user.role,
    userPermissions: user.permissions,
    resourceId,
    context
  }
}

/**
 * Check resource-based permissions (e.g., can user edit this specific post?)
 */
export function checkResourcePermission(
  user: AuthUser | null,
  permission: Permission,
  resourceType: string,
  resourceId: string,
  resourceOwner?: string
): ResourcePermissionCheck {
  const baseCheck = checkPermission(user, permission, resourceId)
  
  // Additional resource-specific checks
  let hasResourcePermission = baseCheck.hasPermission
  
  // If user is admin, they can access any resource
  if (user?.role === UserRole.ADMIN) {
    hasResourcePermission = true
  }
  // If resource has an owner, check if user owns it
  else if (resourceOwner && user?.id === resourceOwner) {
    hasResourcePermission = true
  }
  // For team-based resources, check team membership
  else if (user?.team_id && resourceOwner) {
    // TODO: Implement team membership check
    // hasResourcePermission = await checkTeamMembership(user.id, resourceOwner)
  }

  return {
    ...baseCheck,
    hasPermission: hasResourcePermission,
    resourceType,
    resourceId,
    resourceOwner
  }
}

/**
 * Check multiple permissions at once
 */
export function checkMultiplePermissions(
  user: AuthUser | null,
  permissions: Permission[]
): Record<Permission, boolean> {
  const results: Record<Permission, boolean> = {} as Record<Permission, boolean>
  
  permissions.forEach(permission => {
    results[permission] = checkPermission(user, permission).hasPermission
  })
  
  return results
}

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Get permission descriptions for UI display
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    [Permission.CREATE_POST]: 'Create new posts',
    [Permission.EDIT_POST]: 'Edit existing posts',
    [Permission.DELETE_POST]: 'Delete posts',
    [Permission.PUBLISH_POST]: 'Publish posts immediately',
    [Permission.APPROVE_POST]: 'Approve posts for publication',
    [Permission.SCHEDULE_POST]: 'Schedule posts for future publication',
    [Permission.VIEW_POST]: 'View posts',
    [Permission.UPLOAD_MEDIA]: 'Upload media files',
    [Permission.DELETE_MEDIA]: 'Delete media files',
    [Permission.MANAGE_CONTENT]: 'Manage all content',
    [Permission.VIEW_ANALYTICS]: 'View analytics dashboard',
    [Permission.EXPORT_DATA]: 'Export data and reports',
    [Permission.VIEW_ENGAGEMENT_METRICS]: 'View engagement metrics',
    [Permission.VIEW_PERFORMANCE_REPORTS]: 'View performance reports',
    [Permission.MANAGE_USERS]: 'Manage user accounts',
    [Permission.ASSIGN_ROLES]: 'Assign roles to users',
    [Permission.VIEW_USERS]: 'View user information',
    [Permission.DEACTIVATE_USERS]: 'Deactivate user accounts',
    [Permission.MANAGE_SETTINGS]: 'Manage system settings',
    [Permission.MANAGE_INTEGRATIONS]: 'Manage integrations',
    [Permission.VIEW_SYSTEM_LOGS]: 'View system logs',
    [Permission.MANAGE_TEAMS]: 'Manage teams',
    [Permission.ASSIGN_TO_TEAMS]: 'Assign users to teams',
    [Permission.INVITE_MEMBERS]: 'Invite new team members',
    [Permission.REMOVE_MEMBERS]: 'Remove team members',
    [Permission.MANAGE_AUTOMATION]: 'Manage automation rules',
    [Permission.CREATE_AUTO_REPLIES]: 'Create auto-reply rules',
    [Permission.MANAGE_SCHEDULING]: 'Manage scheduling settings',
    [Permission.VIEW_BILLING]: 'View billing information',
    [Permission.MANAGE_SUBSCRIPTION]: 'Manage subscription',
    [Permission.ACCESS_API]: 'Access API endpoints',
    [Permission.MANAGE_API_KEYS]: 'Manage API keys'
  }
  
  return descriptions[permission] || 'Unknown permission'
}

/**
 * Log permission check for audit purposes
 */
async function logPermissionCheck(
  userId: string,
  permission: Permission,
  result: boolean,
  resourceId?: string,
  context?: Record<string, any>
): Promise<void> {
  try {
    const auditEntry: Omit<PermissionAuditEntry, 'id' | 'created_at'> = {
      user_id: userId,
      action: result ? 'permission_granted' : 'permission_denied',
      permission,
      resource_type: context?.resourceType,
      resource_id: resourceId,
      result: result ? 'allowed' : 'denied',
      reason: result ? 'Permission granted' : 'Insufficient permissions',
      ip_address: context?.ipAddress,
      user_agent: context?.userAgent,
    }

    await getSupabaseAdmin()
      .from('permission_audit_logs')
      .insert(auditEntry)
  } catch (error) {
    console.error('Error logging permission check:', error)
  }
}

/**
 * Middleware function to require resource-based permission
 */
export function requireResourcePermission(permission: Permission, resourceType: string) {
  return function(handler: (req: NextRequest, user: AuthUser, resourceId: string) => Promise<NextResponse>) {
    return async function(req: NextRequest): Promise<NextResponse> {
      const user = await getCurrentUser(req)
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
          { status: 401 }
        )
      }

      // Extract resource ID from request (could be from URL params, body, etc.)
      const resourceId = req.nextUrl.searchParams.get('id') || 
                       req.nextUrl.searchParams.get('resourceId') ||
                       'unknown'

      const permissionCheck = checkResourcePermission(user, permission, resourceType, resourceId)
      
      if (!permissionCheck.hasPermission) {
        await logPermissionCheck(user.id, permission, false, resourceId, {
          resourceType,
          ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent')
        })
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, `Permission denied: ${permission} on ${resourceType}`) },
          { status: 403 }
        )
      }

      return handler(req, user, resourceId)
    }
  }
}
