import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils';
import { AuthErrorType, UserRole } from '@/lib/auth-types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Get all users with their roles
 * GET /api/auth/users
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

      // Only admins can view all users
      if (user.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Admin access required') },
          { status: 403 }
        );
      }

      // Get all users with their profiles and roles
      const { data: usersData, error: usersError } = await getSupabaseAdmin()
        .from('user_profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          display_name,
          email,
          created_at,
          user_roles!inner (
            role,
            assigned_at,
            assigned_by
          )
        `)
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch users') },
          { status: 500 }
        );
      }

      // Transform the data to match expected format
      const users = usersData?.map(userData => ({
        id: userData.user_id,
        name: userData.display_name || `${userData.first_name} ${userData.last_name}`.trim(),
        email: userData.email,
        role: userData.user_roles.role,
        assignedAt: userData.user_roles.assigned_at,
        assignedBy: userData.user_roles.assigned_by,
        createdAt: userData.created_at
      })) || [];

      return NextResponse.json({
        users,
        totalUsers: users.length,
        roles: {
          [UserRole.ADMIN]: users.filter(u => u.role === UserRole.ADMIN).length,
          [UserRole.EDITOR]: users.filter(u => u.role === UserRole.EDITOR).length,
          [UserRole.VIEWER]: users.filter(u => u.role === UserRole.VIEWER).length
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get users') },
        { status: 500 }
      );
    }
  });
}

