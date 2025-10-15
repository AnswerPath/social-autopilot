import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';

/**
 * GET /api/teams/[teamId]
 * Get team details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

      const { teamId } = await params;
      const result = await teamService.getTeam(teamId);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Team not found') },
          { status: 404 }
        );
      }

      // Check if user is a member of the team
      const hasPermission = await teamService.checkTeamPermission(teamId, user.id, 'canViewAnalytics');
      if (!hasPermission) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Access denied') },
          { status: 403 }
        );
      }

      // Get team stats
      const statsResult = await teamService.getTeamStats(teamId);
      
      return NextResponse.json({ 
        team: result.team,
        stats: statsResult.stats 
      });

    } catch (error: any) {
      console.error('Error getting team:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get team') },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * PUT /api/teams/[teamId]
 * Update team
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

      const { teamId } = await params;
      const updateData = await req.json();

      const result = await teamService.updateTeam(teamId, user.id, updateData, req);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to update team') },
          { status: 500 }
        );
      }

      return NextResponse.json({ team: result.team });

    } catch (error: any) {
      console.error('Error updating team:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update team') },
        { status: 500 }
      );
    }
  }))(request);
}

/**
 * DELETE /api/teams/[teamId]
 * Delete team
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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

      const { teamId } = await params;
      const result = await teamService.deleteTeam(teamId, user.id, req);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to delete team') },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });

    } catch (error: any) {
      console.error('Error deleting team:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to delete team') },
        { status: 500 }
      );
    }
  }))(request);
}
