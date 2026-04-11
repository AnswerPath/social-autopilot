import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';

/**
 * POST /api/teams/[teamId]/invitations/[invitationId]/resend
 * Resend invitation email (rotates token).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; invitationId: string }> }
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

      const { teamId, invitationId } = await params;
      const result = await teamService.resendTeamInvitation(teamId, user.id, invitationId, req);

      if (!result.success) {
        const status =
          result.error === 'Insufficient permissions'
            ? 403
            : result.error === 'Invitation not found'
              ? 404
              : 400;
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to resend invitation') },
          { status }
        );
      }

      return NextResponse.json({ invitation: result.invitation });
    } catch (error) {
      console.error('POST resend invitation', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to resend invitation') },
        { status: 500 }
      );
    }
  }))(request);
}
