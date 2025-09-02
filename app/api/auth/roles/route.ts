import { NextRequest, NextResponse } from 'next/server'
import { 
  UserRole, 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth-types'
import { 
  requireAuth,
  requireRole,
  assignUserRole,
  createAuthError,
  logAuditEvent
} from '@/lib/auth-utils'

// Get all users with their roles
export async function GET(request: NextRequest) {
  return requireRole(UserRole.ADMIN)(async (req: NextRequest, user: any) => {
    try {
      // This would typically fetch from your database
      // For now, return a mock response
      const users = [
        {
          id: '1',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
          profile: {
            first_name: 'Admin',
            last_name: 'User',
            display_name: 'Admin User'
          }
        },
        {
          id: '2',
          email: 'editor@example.com',
          role: UserRole.EDITOR,
          profile: {
            first_name: 'Editor',
            last_name: 'User',
            display_name: 'Editor User'
          }
        },
        {
          id: '3',
          email: 'viewer@example.com',
          role: UserRole.VIEWER,
          profile: {
            first_name: 'Viewer',
            last_name: 'User',
            display_name: 'Viewer User'
          }
        }
      ]

      return NextResponse.json({ users })
    } catch (error) {
      console.error('Get users error:', error)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get users') },
        { status: 500 }
      )
    }
  })(request)
}

// Update user role
export async function PUT(request: NextRequest) {
  return requireRole(UserRole.ADMIN)(async (req: NextRequest, user: any) => {
    try {
      const body = await request.json()
      const { userId, role } = body

      if (!userId || !role) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'User ID and role are required') },
          { status: 400 }
        )
      }

      // Validate role
      if (!Object.values(UserRole).includes(role)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid role') },
          { status: 400 }
        )
      }

      // Prevent admin from changing their own role
      if (userId === user.id) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Cannot change your own role') },
          { status: 403 }
        )
      }

      // Assign the new role
      await assignUserRole(userId, role)

      // Log the role change
      await logAuditEvent(
        user.id,
        'role_changed',
        'user',
        userId,
        { new_role: role, changed_by: user.id },
        request
      )

      return NextResponse.json({
        message: 'User role updated successfully',
        userId,
        role
      })
    } catch (error) {
      console.error('Update role error:', error)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update role') },
        { status: 500 }
      )
    }
  })(request)
}

// Get available roles
export async function POST(request: NextRequest) {
  return requireAuth(async (req: NextRequest, user: any) => {
    try {
      const roles = [
        {
          value: UserRole.ADMIN,
          label: 'Administrator',
          description: 'Full access to all features and user management',
          permissions: [
            'create_post', 'edit_post', 'delete_post', 'approve_post', 'schedule_post',
            'view_analytics', 'export_data', 'manage_users', 'assign_roles',
            'manage_settings', 'manage_integrations', 'manage_teams', 'assign_to_teams'
          ]
        },
        {
          value: UserRole.EDITOR,
          label: 'Editor',
          description: 'Can create, edit, and schedule posts, view analytics',
          permissions: [
            'create_post', 'edit_post', 'schedule_post', 'view_analytics', 'export_data'
          ]
        },
        {
          value: UserRole.VIEWER,
          label: 'Viewer',
          description: 'Can view analytics and read-only access to content',
          permissions: [
            'view_analytics'
          ]
        }
      ]

      return NextResponse.json({ roles })
    } catch (error) {
      console.error('Get roles error:', error)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get roles') },
        { status: 500 }
      )
    }
  })(request)
}
