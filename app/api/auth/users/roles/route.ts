import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError,
  logAuditEvent
} from '@/lib/auth-utils';
import { AuthErrorType, UserRole, Permission } from '@/lib/auth-types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Get user roles and permissions
 * GET /api/auth/users/roles
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
      const userId = searchParams.get('userId') || user.id;

      // Users can only view their own roles unless they're admin
      if (userId !== user.id && user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot view other users\' roles') },
          { status: 403 }
        );
      }

      // Get user's role and permissions
      const { data: roleData, error: roleError } = await getSupabaseAdmin()
        .from('user_roles')
        .select('role, assigned_at, assigned_by')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch user role') },
          { status: 500 }
        );
      }

      if (!roleData) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User role not found') },
          { status: 404 }
        );
      }

      // Get user profile for additional context
      const { data: profileData } = await getSupabaseAdmin()
        .from('user_profiles')
        .select('first_name, last_name, display_name, email')
        .eq('user_id', userId)
        .single();

      // Get permissions for the role
      let permissions: Permission[] = [];
      
      if (Object.values(UserRole).includes(roleData.role as UserRole)) {
        // Built-in role
        const { ROLE_PERMISSIONS } = await import('@/lib/auth-types');
        permissions = ROLE_PERMISSIONS[roleData.role as UserRole];
      } else {
        // Custom role
        const { data: customRoleData } = await getSupabaseAdmin()
          .from('custom_roles')
          .select('permissions')
          .eq('role_id', roleData.role)
          .single();
        
        if (customRoleData) {
          permissions = customRoleData.permissions;
        }
      }

      return NextResponse.json({
        user: {
          id: userId,
          name: profileData?.display_name || `${profileData?.first_name} ${profileData?.last_name}`.trim(),
          email: profileData?.email
        },
        role: {
          id: roleData.role,
          assignedAt: roleData.assigned_at,
          assignedBy: roleData.assigned_by
        },
        permissions: permissions.map(permission => ({
          id: permission,
          name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: getPermissionCategory(permission)
        })),
        permissionCount: permissions.length
      });

    } catch (error) {
      console.error('Get user roles error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get user roles') },
        { status: 500 }
      );
    }
  });
}

/**
 * Assign role to user
 * POST /api/auth/users/roles
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

      // Only admins can assign roles
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const body = await req.json();
      const { userId, roleId } = body;

      if (!userId || !roleId) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User ID and Role ID are required') },
          { status: 400 }
        );
      }

      // Validate role exists
      const isValidBuiltInRole = Object.values(UserRole).includes(roleId as UserRole);
      let isValidCustomRole = false;

      if (!isValidBuiltInRole) {
        const { data: customRole } = await getSupabaseAdmin()
          .from('custom_roles')
          .select('role_id')
          .eq('role_id', roleId)
          .single();
        
        isValidCustomRole = !!customRole;
      }

      if (!isValidBuiltInRole && !isValidCustomRole) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid role ID') },
          { status: 400 }
        );
      }

      // Check if user exists
      const { data: userProfile } = await getSupabaseAdmin()
        .from('user_profiles')
        .select('user_id, first_name, last_name, display_name')
        .eq('user_id', userId)
        .single();

      if (!userProfile) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User not found') },
          { status: 404 }
        );
      }

      // Assign role (upsert to handle existing roles)
      const { data: roleData, error: roleError } = await getSupabaseAdmin()
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: roleId,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (roleError) {
        console.error('Error assigning role:', roleError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to assign role') },
          { status: 500 }
        );
      }

      // Log audit event
      await logAuditEvent({
        user_id: user.id,
        action: 'ROLE_ASSIGNED',
        resource_type: 'user_role',
        resource_id: userId,
        details: {
          assigned_role: roleId,
          target_user: userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`.trim()
        }
      });

      return NextResponse.json({
        message: 'Role assigned successfully',
        user: {
          id: userId,
          name: userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`.trim()
        },
        role: {
          id: roleData.role,
          assignedAt: roleData.assigned_at,
          assignedBy: roleData.assigned_by
        }
      });

    } catch (error) {
      console.error('Assign role error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Remove role from user
 * DELETE /api/auth/users/roles
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

      // Only admins can remove roles
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const userId = searchParams.get('userId');

      if (!userId) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User ID is required') },
          { status: 400 }
        );
      }

      // Get user info for audit log
      const { data: userProfile } = await getSupabaseAdmin()
        .from('user_profiles')
        .select('first_name, last_name, display_name')
        .eq('user_id', userId)
        .single();

      if (!userProfile) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User not found') },
          { status: 404 }
        );
      }

      // Get current role for audit log
      const { data: currentRole } = await getSupabaseAdmin()
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (!currentRole) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User has no assigned role') },
          { status: 404 }
        );
      }

      // Remove role
      const { error: deleteError } = await getSupabaseAdmin()
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error removing role:', deleteError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to remove role') },
          { status: 500 }
        );
      }

      // Log audit event
      await logAuditEvent({
        user_id: user.id,
        action: 'ROLE_REMOVED',
        resource_type: 'user_role',
        resource_id: userId,
        details: {
          removed_role: currentRole.role,
          target_user: userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`.trim()
        }
      });

      return NextResponse.json({
        message: 'Role removed successfully',
        user: {
          id: userId,
          name: userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`.trim()
        },
        removedRole: currentRole.role
      });

    } catch (error) {
      console.error('Remove role error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

// Helper function
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
