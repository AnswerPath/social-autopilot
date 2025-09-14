import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils';
import { AuthErrorType, UserRole, Permission, ROLE_PERMISSIONS } from '@/lib/auth-types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Get all available roles and their permissions
 * GET /api/auth/roles
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

      // Only admins can view role definitions
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const roles = Object.values(UserRole).map(role => ({
        id: role,
        name: role.charAt(0) + role.slice(1).toLowerCase(),
        description: getRoleDescription(role),
        permissions: ROLE_PERMISSIONS[role],
        permissionCount: ROLE_PERMISSIONS[role].length,
        isDefault: role === UserRole.VIEWER
      }));

      return NextResponse.json({
        roles,
        totalRoles: roles.length,
        permissions: Object.values(Permission).map(permission => ({
          id: permission,
          name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: getPermissionCategory(permission)
        }))
      });

    } catch (error) {
      console.error('Get roles error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get roles') },
        { status: 500 }
      );
    }
  });
}

/**
 * Create a new custom role
 * POST /api/auth/roles
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

      // Only admins can create roles
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { name, description, permissions } = body;

      if (!name || !Array.isArray(permissions)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Name and permissions are required') },
          { status: 400 }
        );
      }

      // Validate permissions
      const validPermissions = Object.values(Permission);
      const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as Permission));
      
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, `Invalid permissions: ${invalidPermissions.join(', ')}`) },
          { status: 400 }
        );
      }

      // Check if role name already exists
      const roleId = name.toUpperCase().replace(/\s+/g, '_');
      if (Object.values(UserRole).includes(roleId as UserRole)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Role name already exists') },
          { status: 400 }
        );
      }

      // Store custom role in database
      const { data, error } = await getSupabaseAdmin()
        .from('custom_roles')
        .insert({
          role_id: roleId,
          name,
          description: description || '',
          permissions,
          created_by: user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating custom role:', error);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create role') },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Role created successfully',
        role: {
          id: data.role_id,
          name: data.name,
          description: data.description,
          permissions: data.permissions,
          permissionCount: data.permissions.length,
          isCustom: true,
          createdAt: data.created_at
        }
      });

    } catch (error) {
      console.error('Create role error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Update a custom role
 * PUT /api/auth/roles
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

      // Only admins can update roles
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { roleId, name, description, permissions } = body;

      if (!roleId) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Role ID is required') },
          { status: 400 }
        );
      }

      // Check if it's a built-in role
      if (Object.values(UserRole).includes(roleId as UserRole)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Cannot modify built-in roles') },
          { status: 400 }
        );
      }

      // Validate permissions
      const validPermissions = Object.values(Permission);
      const invalidPermissions = permissions.filter((p: string) => !validPermissions.includes(p as Permission));
      
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, `Invalid permissions: ${invalidPermissions.join(', ')}`) },
          { status: 400 }
        );
      }

      // Update custom role
      const { data, error } = await getSupabaseAdmin()
        .from('custom_roles')
        .update({
          name: name || undefined,
          description: description || undefined,
          permissions: permissions || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('role_id', roleId)
        .select()
        .single();

      if (error) {
        console.error('Error updating custom role:', error);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update role') },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Role not found') },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: 'Role updated successfully',
        role: {
          id: data.role_id,
          name: data.name,
          description: data.description,
          permissions: data.permissions,
          permissionCount: data.permissions.length,
          isCustom: true,
          updatedAt: data.updated_at
        }
      });

    } catch (error) {
      console.error('Update role error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Delete a custom role
 * DELETE /api/auth/roles
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

      // Only admins can delete roles
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const roleId = searchParams.get('roleId');

      if (!roleId) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Role ID is required') },
          { status: 400 }
        );
      }

      // Check if it's a built-in role
      if (Object.values(UserRole).includes(roleId as UserRole)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Cannot delete built-in roles') },
          { status: 400 }
        );
      }

      // Check if any users are assigned to this role
      const { data: usersWithRole, error: checkError } = await getSupabaseAdmin()
        .from('user_roles')
        .select('user_id')
        .eq('role', roleId)
        .limit(1);

      if (checkError) {
        console.error('Error checking role usage:', checkError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to check role usage') },
          { status: 500 }
        );
      }

      if (usersWithRole && usersWithRole.length > 0) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Cannot delete role that is assigned to users') },
          { status: 400 }
        );
      }

      // Delete custom role
      const { error } = await getSupabaseAdmin()
        .from('custom_roles')
        .delete()
        .eq('role_id', roleId);

      if (error) {
        console.error('Error deleting custom role:', error);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to delete role') },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Role deleted successfully'
      });

    } catch (error) {
      console.error('Delete role error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

// Helper functions
function getRoleDescription(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return 'Full system access with all permissions';
    case UserRole.EDITOR:
      return 'Content management and publishing permissions';
    case UserRole.VIEWER:
      return 'Read-only access to content and analytics';
    default:
      return 'Custom role with specific permissions';
  }
}

function getPermissionCategory(permission: Permission): string {
  if (permission.includes('POST')) return 'Post Management';
  if (permission.includes('MEDIA') || permission.includes('CONTENT')) return 'Content Management';
  if (permission.includes('ANALYTICS') || permission.includes('REPORTS')) return 'Analytics & Reporting';
  if (permission.includes('USER') || permission.includes('ROLE')) return 'User Management';
  if (permission.includes('SETTINGS') || permission.includes('INTEGRATION')) return 'Settings & Configuration';
  if (permission.includes('TEAM') || permission.includes('MEMBER')) return 'Team Management';
  if (permission.includes('AUTOMATION') || permission.includes('SCHEDULING')) return 'Automation';
  if (permission.includes('BILLING') || permission.includes('SUBSCRIPTION')) return 'Billing & Subscription';
  if (permission.includes('API')) return 'API Access';
  return 'Other';
}