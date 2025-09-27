import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { granularPermissionService } from '@/lib/granular-permissions';
import { Permission, AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';

interface PermissionMiddlewareOptions {
  permission: Permission;
  resourceType?: string;
  resourceIdExtractor?: (request: NextRequest) => string | undefined;
  allowOwnership?: boolean;
  customContext?: Record<string, any>;
}

/**
 * Create permission middleware for API routes
 */
export function createPermissionMiddleware(options: PermissionMiddlewareOptions) {
  return async function permissionMiddleware(request: NextRequest) {
    try {
      // Get current user
      const user = await getCurrentUser(request);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      // Extract resource ID if needed
      let resourceId: string | undefined;
      if (options.resourceIdExtractor) {
        resourceId = options.resourceIdExtractor(request);
      }

      // Create permission context
      const permissionContext = {
        user,
        resource_type: options.resourceType,
        resource_id: resourceId,
        action: request.method,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date(),
        metadata: options.customContext
      };

      // Check permission
      const result = await granularPermissionService.hasPermission(
        permissionContext,
        options.permission,
        options.resourceType,
        resourceId
      );

      if (!result.allowed) {
        return NextResponse.json(
          { 
            error: createAuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS, 
              `Permission denied: ${result.reason}`
            )
          },
          { status: 403 }
        );
      }

      // Add permission info to request headers for downstream use
      const response = NextResponse.next();
      response.headers.set('x-permission-source', result.source);
      response.headers.set('x-permission-reason', result.reason);

      return response;

    } catch (error) {
      console.error('Permission middleware error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Permission check failed') },
        { status: 500 }
      );
    }
  };
}

/**
 * Higher-order function to wrap API route handlers with permission checks
 */
export function withPermission<T extends any[]>(
  options: PermissionMiddlewareOptions,
  handler: (...args: T) => Promise<Response>
) {
  return async function protectedHandler(request: NextRequest, ...args: any[]): Promise<Response> {
    // Run permission middleware first
    const middlewareResponse = await createPermissionMiddleware(options)(request);
    
    // If middleware returned a response (error), return it
    if (middlewareResponse.status !== 200) {
      return middlewareResponse;
    }

    // Otherwise, continue to the actual handler
    return handler(request, ...args);
  };
}

/**
 * Convenience function for checking permissions in API routes
 */
export async function checkPermissionInRoute(
  request: NextRequest,
  permission: Permission,
  resourceType?: string,
  resourceId?: string
): Promise<{ allowed: boolean; user: any; context: any }> {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return {
      allowed: false,
      user: null,
      context: null
    };
  }

  const permissionContext = {
    user,
    resource_type: resourceType,
    resource_id: resourceId,
    action: request.method,
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    user_agent: request.headers.get('user-agent') || 'unknown',
    timestamp: new Date()
  };

  const result = await granularPermissionService.hasPermission(
    permissionContext,
    permission,
    resourceType,
    resourceId
  );

  return {
    allowed: result.allowed,
    user,
    context: permissionContext
  };
}

/**
 * Resource ID extractors for common patterns
 */
export const resourceIdExtractors = {
  fromParams: (request: NextRequest, paramName: string = 'id') => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const paramIndex = pathParts.indexOf(paramName);
    return paramIndex !== -1 && paramIndex < pathParts.length - 1 
      ? pathParts[paramIndex + 1] 
      : undefined;
  },
  
  fromQuery: (request: NextRequest, paramName: string = 'id') => {
    const url = new URL(request.url);
    return url.searchParams.get(paramName) || undefined;
  },
  
  fromBody: async (request: NextRequest, fieldName: string = 'id') => {
    try {
      const body = await request.json();
      return body[fieldName] || undefined;
    } catch {
      return undefined;
    }
  },
  
  fromHeaders: (request: NextRequest, headerName: string = 'x-resource-id') => {
    return request.headers.get(headerName) || undefined;
  }
};

/**
 * Common permission middleware presets
 */
export const permissionMiddleware = {
  // Post management permissions
  createPost: createPermissionMiddleware({
    permission: Permission.CREATE_POST
  }),
  
  editPost: createPermissionMiddleware({
    permission: Permission.EDIT_POST,
    resourceType: 'post',
    resourceIdExtractor: (req) => resourceIdExtractors.fromParams(req, 'id'),
    allowOwnership: true
  }),
  
  deletePost: createPermissionMiddleware({
    permission: Permission.DELETE_POST,
    resourceType: 'post',
    resourceIdExtractor: (req) => resourceIdExtractors.fromParams(req, 'id'),
    allowOwnership: true
  }),
  
  publishPost: createPermissionMiddleware({
    permission: Permission.PUBLISH_POST,
    resourceType: 'post',
    resourceIdExtractor: (req) => resourceIdExtractors.fromParams(req, 'id')
  }),
  
  // User management permissions
  manageUsers: createPermissionMiddleware({
    permission: Permission.MANAGE_USERS
  }),
  
  assignRoles: createPermissionMiddleware({
    permission: Permission.ASSIGN_ROLES
  }),
  
  viewUsers: createPermissionMiddleware({
    permission: Permission.VIEW_USERS
  }),
  
  // Media management permissions
  uploadMedia: createPermissionMiddleware({
    permission: Permission.UPLOAD_MEDIA
  }),
  
  editMedia: createPermissionMiddleware({
    permission: Permission.EDIT_MEDIA,
    resourceType: 'media',
    resourceIdExtractor: (req) => resourceIdExtractors.fromParams(req, 'id'),
    allowOwnership: true
  }),
  
  deleteMedia: createPermissionMiddleware({
    permission: Permission.DELETE_MEDIA,
    resourceType: 'media',
    resourceIdExtractor: (req) => resourceIdExtractors.fromParams(req, 'id'),
    allowOwnership: true
  }),
  
  // Analytics permissions
  viewAnalytics: createPermissionMiddleware({
    permission: Permission.VIEW_ANALYTICS
  }),
  
  exportData: createPermissionMiddleware({
    permission: Permission.EXPORT_DATA
  }),
  
  // Settings permissions
  manageSettings: createPermissionMiddleware({
    permission: Permission.MANAGE_SETTINGS
  }),
  
  viewSettings: createPermissionMiddleware({
    permission: Permission.VIEW_APP_SETTINGS
  }),
  
  // Team management permissions
  manageTeams: createPermissionMiddleware({
    permission: Permission.MANAGE_TEAMS
  }),
  
  inviteMembers: createPermissionMiddleware({
    permission: Permission.INVITE_MEMBERS
  }),
  
  // Automation permissions
  manageAutomation: createPermissionMiddleware({
    permission: Permission.MANAGE_AUTOMATION
  }),
  
  createAutoReplies: createPermissionMiddleware({
    permission: Permission.CREATE_AUTO_REPLIES
  }),
  
  // API permissions
  accessApi: createPermissionMiddleware({
    permission: Permission.ACCESS_API
  }),
  
  manageApiKeys: createPermissionMiddleware({
    permission: Permission.MANAGE_API_KEYS
  }),
  
  // Granular permissions
  manageOwnProfile: createPermissionMiddleware({
    permission: Permission.MANAGE_OWN_PROFILE,
    allowOwnership: true
  }),
  
  viewAuditLogs: createPermissionMiddleware({
    permission: Permission.VIEW_AUDIT_LOGS
  }),
  
  managePermissions: createPermissionMiddleware({
    permission: Permission.MANAGE_PERMISSIONS
  })
};
