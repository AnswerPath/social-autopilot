import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';
import { TeamRole, TeamMemberFilters } from '@/lib/team-types';

/**
 * GET /api/teams/[teamId]/members
 * Get team members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  return withActivityLogging(async (req: NextRequest) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
          { status: 401 }
        );
      }

      const { teamId } = params;
      
      // Check if user is a member of the team
      const hasPermission = await teamService.checkTeamPermission(teamId, user.id, 'canViewAnalytics');
      if (!hasPermission) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Access denied') },
          { status: 403 }
        );
      }

      // Parse filters
      const { searchParams } = new URL(req.url);
      const filters: TeamMemberFilters = {};
      
      if (searchParams.get('role')) {
        filters.role = searchParams.get('role') as TeamRole;
      }
      if (searchParams.get('status')) {
        filters.status = searchParams.get('status') as any;
      }
      if (searchParams.get('search')) {
        filters.search = searchParams.get('search') || undefined;
      }
      if (searchParams.get('joined_after')) {
        filters.joined_after = searchParams.get('joined_after') || undefined;
      }
      if (searchParams.get('joined_before')) {
        filters.joined_before = searchParams.get('joined_before') || undefined;
      }

      const result = await teamService.getTeamMembers(teamId, filters);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to get team members') },
          { status: 500 }
        );
      }

      return NextResponse.json({ members: result.members });

    } catch (error: any) {
      console.error('Error getting team members:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get team members') },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * POST /api/teams/[teamId]/members
 * Invite member to team
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  return withRateLimit('general')(withActivityLogging(async (req: NextRequest) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
          { status: 401 }
        );
      }

      const { teamId } = params;
      const invitationData = await req.json();

      // Validate required fields
      if (!invitationData.email || !invitationData.role) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Email and role are required') },
          { status: 400 }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(invitationData.email)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid email format') },
          { status: 400 }
        );
      }

      // Validate role
      if (!Object.values(TeamRole).includes(invitationData.role)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid role') },
          { status: 400 }
        );
      }

      const result = await teamService.inviteMember(teamId, user.id, invitationData, req);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to invite member') },
          { status: 500 }
        );
      }

      return NextResponse.json({ invitation: result.invitation }, { status: 201 });

    } catch (error: any) {
      console.error('Error inviting member:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to invite member') },
        { status: 500 }
      );
    }
  }))(request);
}
