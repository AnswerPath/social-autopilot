import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError,
  logAuditEvent
} from '@/lib/auth-utils';
import { AuthErrorType, UserRole, Permission, ROLE_PERMISSIONS } from '@/lib/auth-types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Get all permissions and their categories
 * GET /api/auth/permissions
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

      // Check if user wants all permissions (admin only) or just their own permissions
      const url = new URL(req.url);
      const getAllPermissions = url.searchParams.get('all') === 'true';
      
      if (getAllPermissions && user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      const permissions = Object.values(Permission).map(permission => ({
        id: permission,
        name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        category: getPermissionCategory(permission),
        description: getPermissionDescription(permission),
        isDangerous: isDangerousPermission(permission)
      }));

      // Group by category
      const permissionsByCategory = permissions.reduce((acc, permission) => {
        const category = permission.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(permission);
        return acc;
      }, {} as Record<string, typeof permissions>);

      if (getAllPermissions) {
        // Return all permissions for admin users
        return NextResponse.json({
          permissions,
          permissionsByCategory,
          categories: Object.keys(permissionsByCategory).map(category => ({
            name: category,
            count: permissionsByCategory[category].length,
            dangerousCount: permissionsByCategory[category].filter(p => p.isDangerous).length
          })),
          totalPermissions: permissions.length,
          dangerousPermissions: permissions.filter(p => p.isDangerous).length
        });
      } else {
        // Return user's role and basic permission info
        return NextResponse.json({
          userRole: user.role,
          userPermissions: ROLE_PERMISSIONS[user.role] || []
        });
      }

    } catch (error) {
      console.error('Get permissions error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get permissions') },
        { status: 500 }
      );
    }
  });
}

/**
 * Check if user has specific permission
 * POST /api/auth/permissions/check
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
      const { permission, userId } = body;

      if (!permission) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Permission is required') },
          { status: 400 }
        );
      }

      // Validate permission exists
      if (!Object.values(Permission).includes(permission as Permission)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid permission') },
          { status: 400 }
        );
      }

      const targetUserId = userId || user.id;

      // Users can only check their own permissions unless they're admin
      if (targetUserId !== user.id && user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot check other users\' permissions') },
          { status: 403 }
        );
      }

      // Get user's role
      const { data: roleData, error: roleError } = await getSupabaseAdmin()
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch user role') },
          { status: 500 }
        );
      }

      if (!roleData) {
        return NextResponse.json({
          hasPermission: false,
          reason: 'No role assigned'
        });
      }

      // Check if user has permission
      let hasPermission = false;
      
      if (Object.values(UserRole).includes(roleData.role as UserRole)) {
        // Built-in role
        const { ROLE_PERMISSIONS } = await import('@/lib/auth-types');
        hasPermission = ROLE_PERMISSIONS[roleData.role as UserRole].includes(permission as Permission);
      } else {
        // Custom role
        const { data: customRoleData } = await getSupabaseAdmin()
          .from('custom_roles')
          .select('permissions')
          .eq('role_id', roleData.role)
          .single();
        
        if (customRoleData) {
          hasPermission = customRoleData.permissions.includes(permission);
        }
      }

      // Log permission check for audit
      await logAuditEvent({
        user_id: user.id,
        action: 'PERMISSION_CHECKED',
        resource_type: 'permission',
        resource_id: permission,
        details: {
          checked_permission: permission,
          target_user: targetUserId,
          has_permission: hasPermission,
          user_role: roleData.role
        }
      });

      return NextResponse.json({
        hasPermission,
        user: {
          id: targetUserId,
          role: roleData.role
        },
        permission: {
          id: permission,
          name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: getPermissionCategory(permission as Permission)
        }
      });

    } catch (error) {
      console.error('Check permission error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

// Helper functions
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

function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    // Post Management
    [Permission.CREATE_POST]: 'Create new posts and content',
    [Permission.EDIT_POST]: 'Edit existing posts and content',
    [Permission.DELETE_POST]: 'Delete posts and content',
    [Permission.PUBLISH_POST]: 'Publish posts to social media platforms',
    [Permission.SCHEDULE_POST]: 'Schedule posts for future publication',
    
    // Content Management
    [Permission.UPLOAD_MEDIA]: 'Upload images, videos, and other media files',
    [Permission.MANAGE_MEDIA]: 'Manage and organize media library',
    [Permission.EDIT_MEDIA]: 'Edit and modify media files',
    [Permission.DELETE_MEDIA]: 'Delete media files from library',
    
    // Analytics & Reporting
    [Permission.VIEW_ANALYTICS]: 'View analytics and performance metrics',
    [Permission.EXPORT_REPORTS]: 'Export analytics reports and data',
    [Permission.VIEW_ENGAGEMENT]: 'View engagement metrics and insights',
    [Permission.VIEW_REACH]: 'View reach and impression data',
    
    // User Management
    [Permission.MANAGE_USERS]: 'Manage user accounts and profiles',
    [Permission.ASSIGN_ROLES]: 'Assign and modify user roles',
    [Permission.VIEW_USERS]: 'View user information and activity',
    [Permission.DELETE_USERS]: 'Delete user accounts',
    
    // Settings & Configuration
    [Permission.MANAGE_SETTINGS]: 'Manage system settings and configuration',
    [Permission.MANAGE_INTEGRATIONS]: 'Manage third-party integrations',
    [Permission.VIEW_SETTINGS]: 'View system settings and configuration',
    [Permission.MANAGE_BRANDING]: 'Manage brand settings and customization',
    
    // Team Management
    [Permission.MANAGE_TEAM]: 'Manage team members and structure',
    [Permission.INVITE_MEMBERS]: 'Invite new team members',
    [Permission.REMOVE_MEMBERS]: 'Remove team members',
    [Permission.VIEW_TEAM]: 'View team information and structure',
    
    // Automation
    [Permission.MANAGE_AUTOMATION]: 'Create and manage automation rules',
    [Permission.VIEW_AUTOMATION]: 'View automation rules and history',
    [Permission.DELETE_AUTOMATION]: 'Delete automation rules',
    [Permission.SCHEDULE_AUTOMATION]: 'Schedule and manage automated tasks',
    
    // Billing & Subscription
    [Permission.MANAGE_BILLING]: 'Manage billing and subscription settings',
    [Permission.VIEW_BILLING]: 'View billing information and invoices',
    [Permission.MANAGE_SUBSCRIPTION]: 'Manage subscription plans and features',
    [Permission.VIEW_SUBSCRIPTION]: 'View subscription details and usage',
    
    // API Access
    [Permission.API_READ]: 'Read data through API endpoints',
    [Permission.API_WRITE]: 'Write data through API endpoints',
    [Permission.API_DELETE]: 'Delete data through API endpoints',
    [Permission.MANAGE_API_KEYS]: 'Manage API keys and access tokens'
  };

  return descriptions[permission] || 'Custom permission';
}

function isDangerousPermission(permission: Permission): boolean {
  const dangerousPermissions = [
    Permission.DELETE_POST,
    Permission.DELETE_MEDIA,
    Permission.DELETE_USERS,
    Permission.DELETE_AUTOMATION,
    Permission.MANAGE_USERS,
    Permission.ASSIGN_ROLES,
    Permission.MANAGE_BILLING,
    Permission.MANAGE_SUBSCRIPTION,
    Permission.API_DELETE,
    Permission.MANAGE_API_KEYS
  ];

  return dangerousPermissions.includes(permission);
}