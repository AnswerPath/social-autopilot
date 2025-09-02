import { NextRequest, NextResponse } from 'next/server';
import { Permission, UserRole, AuthErrorType } from '@/lib/auth-types';
import { 
  getCurrentUser, 
  checkPermission, 
  checkMultiplePermissions, 
  getRolePermissions, 
  getPermissionDescription,
  requireAuth,
  createAuthError 
} from '@/lib/auth-utils';

/**
 * GET /api/auth/permissions
 * Get current user's permissions and available permissions
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    );
  }

  // Get all available permissions with descriptions
  const allPermissions = Object.values(Permission);
  const permissionDescriptions = allPermissions.reduce((acc, permission) => {
    acc[permission] = getPermissionDescription(permission);
    return acc;
  }, {} as Record<Permission, string>);

  // Get role permissions
  const rolePermissions = getRolePermissions(user.role);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    permissions: {
      userPermissions: user.permissions,
      rolePermissions,
      allPermissions: permissionDescriptions
    },
    role: {
      current: user.role,
      available: Object.values(UserRole)
    }
  });
}

/**
 * POST /api/auth/permissions/check
 * Check if user has specific permissions
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { permissions, resourceId, context } = body;

    if (!permissions) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Permissions array is required') },
        { status: 400 }
      );
    }

    // Check single permission
    if (typeof permissions === 'string') {
      const permission = permissions as Permission;
      const check = checkPermission(user, permission, resourceId, context);
      
      return NextResponse.json({
        permission: check.requiredPermission,
        hasPermission: check.hasPermission,
        userRole: check.userRole,
        resourceId: check.resourceId,
        context: check.context
      });
    }

    // Check multiple permissions
    if (Array.isArray(permissions)) {
      const permissionArray = permissions as Permission[];
      const results = checkMultiplePermissions(user, permissionArray);
      
      return NextResponse.json({
        permissions: results,
        userRole: user.role,
        resourceId,
        context
      });
    }

    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Invalid permissions format') },
      { status: 400 }
    );
  } catch (error) {
    console.error('Permission check error:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to check permissions') },
      { status: 500 }
    );
  }
}
