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
const GetResourcePermissionsSchema = z.object({
  userId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  permission: z.nativeEnum(Permission).optional()
});

const RevokeResourcePermissionSchema = z.object({
  permissionId: z.string().uuid()
});

/**
 * Get resource permissions
 * GET /api/auth/granular-permissions/resource
 */
export async function GET(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      const { searchParams } = new URL(req.url);
      const queryParams = {
        userId: searchParams.get('userId') || undefined,
        resourceType: searchParams.get('resourceType') || undefined,
        resourceId: searchParams.get('resourceId') || undefined,
        permission: searchParams.get('permission') as Permission || undefined
      };

      const validation = GetResourcePermissionsSchema.safeParse(queryParams);
      
      if (!validation.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid query parameters') },
          { status: 400 }
        );
      }

      const { userId, resourceType, resourceId, permission } = validation.data;
      const targetUserId = userId || user.id;

      // Users can only view their own permissions unless they're admin
      if (targetUserId !== user.id && user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot view other users\' permissions') },
          { status: 403 }
        );
      }

      // Get user's effective permissions
      const effectivePermissions = await granularPermissionService.getUserEffectivePermissions(
        targetUserId,
        resourceType,
        resourceId
      );

      // Filter by permission if specified
      let filteredResourcePermissions = effectivePermissions.resourcePermissions;
      if (permission) {
        filteredResourcePermissions = filteredResourcePermissions.filter(
          rp => rp.permission === permission
        );
      }

      return NextResponse.json({
        user: {
          id: targetUserId
        },
        permissions: {
          role: effectivePermissions.rolePermissions,
          custom: effectivePermissions.customPermissions,
          resource: filteredResourcePermissions,
          overrides: effectivePermissions.overrides
        },
        summary: {
          totalRolePermissions: effectivePermissions.rolePermissions.length,
          totalCustomPermissions: effectivePermissions.customPermissions.length,
          totalResourcePermissions: filteredResourcePermissions.length,
          totalOverrides: effectivePermissions.overrides.length
        }
      });

    } catch (error) {
      console.error('Get resource permissions error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Revoke resource permission
 * DELETE /api/auth/granular-permissions/resource
 */
export async function DELETE(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
          { status: 401 }
        );
      }

      // Only admins can revoke resource permissions
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const validation = RevokeResourcePermissionSchema.safeParse(body);
      
      if (!validation.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid request data') },
          { status: 400 }
        );
      }

      const { permissionId } = validation.data;

      // Revoke the resource permission
      await granularPermissionService.revokeResourcePermission(permissionId, user.id);

      return NextResponse.json({
        success: true,
        message: 'Resource permission revoked successfully'
      });

    } catch (error) {
      console.error('Revoke resource permission error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to revoke resource permission') },
        { status: 500 }
      );
    }
  });
}
