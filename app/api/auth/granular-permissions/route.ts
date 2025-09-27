import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError,
  logAuditEvent
} from '@/lib/auth-utils';
import { AuthErrorType, UserRole, Permission } from '@/lib/auth-types';
import { granularPermissionService } from '@/lib/granular-permissions';
import { withRateLimit } from '@/lib/rate-limiting';
import { z } from 'zod';

// Validation schemas
const GrantResourcePermissionSchema = z.object({
  userId: z.string().uuid(),
  permission: z.nativeEnum(Permission),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  conditions: z.array(z.object({
    type: z.enum(['time', 'location', 'device', 'ip', 'custom']),
    operator: z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'greater_than', 'less_than']),
    value: z.any(),
    field: z.string().optional()
  })).optional()
});

const CreateOverrideSchema = z.object({
  userId: z.string().uuid(),
  permission: z.nativeEnum(Permission),
  action: z.enum(['grant', 'deny']),
  reason: z.string().min(1),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

const CheckPermissionSchema = z.object({
  permission: z.nativeEnum(Permission),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  userId: z.string().uuid().optional()
});

/**
 * Check granular permissions
 * POST /api/auth/granular-permissions/check
 */
export async function POST(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      const body = await req.json();
      const validation = CheckPermissionSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid request data') },
          { status: 400 }
        );
      }

      const { permission, resourceType, resourceId, userId } = validation.data;
      const targetUserId = userId || user.id;

      // Users can only check their own permissions unless they're admin
      if (targetUserId !== user.id && user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot check other users\' permissions') },
          { status: 403 }
        );
      }

      // Get target user for permission check
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = getSupabaseAdmin();
      
      const { data: targetUserData, error: userError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single();

      if (userError || !targetUserData) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.USER_NOT_FOUND, 'Target user not found') },
          { status: 404 }
        );
      }

      // Create permission context
      const permissionContext = {
        user: {
          id: targetUserId,
          role: targetUserData.role as UserRole,
          permissions: [] // Will be populated by the service
        },
        resource_type: resourceType,
        resource_id: resourceId,
        action: 'check',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      };

      // Check permission
      const result = await granularPermissionService.hasPermission(
        permissionContext,
        permission,
        resourceType,
        resourceId
      );

      return NextResponse.json({
        allowed: result.allowed,
        reason: result.reason,
        source: result.source,
        details: result.details,
        permission: {
          id: permission,
          name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          resourceType,
          resourceId
        },
        user: {
          id: targetUserId,
          role: targetUserData.role
        }
      });

    } catch (error) {
      console.error('Check granular permission error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Grant resource permission to user
 * PUT /api/auth/granular-permissions/grant-resource
 */
export async function PUT(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      // Only admins can grant resource permissions
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const validation = GrantResourcePermissionSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid request data') },
          { status: 400 }
        );
      }

      const { userId, permission, resourceType, resourceId, expiresAt, conditions } = validation.data;

      // Grant the resource permission
      const resourcePermission = await granularPermissionService.grantResourcePermission(
        userId,
        permission,
        resourceType,
        resourceId,
        user.id,
        expiresAt,
        conditions
      );

      return NextResponse.json({
        success: true,
        resourcePermission,
        message: 'Resource permission granted successfully'
      });

    } catch (error) {
      console.error('Grant resource permission error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to grant resource permission') },
        { status: 500 }
      );
    }
  });
}

/**
 * Create permission override
 * PATCH /api/auth/granular-permissions/override
 */
export async function PATCH(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      // Only admins can create permission overrides
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const validation = CreateOverrideSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid request data') },
          { status: 400 }
        );
      }

      const { userId, permission, action, reason, resourceType, resourceId, expiresAt } = validation.data;

      // Create the permission override
      const permissionOverride = await granularPermissionService.createPermissionOverride(
        userId,
        permission,
        action,
        reason,
        user.id,
        resourceType,
        resourceId,
        expiresAt
      );

      return NextResponse.json({
        success: true,
        permissionOverride,
        message: `Permission ${action} override created successfully`
      });

    } catch (error) {
      console.error('Create permission override error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create permission override') },
        { status: 500 }
      );
    }
  });
}
