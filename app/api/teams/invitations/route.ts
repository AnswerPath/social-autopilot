import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';

/**
 * GET /api/teams/invitations
 * Get user's pending invitations
 */
export const GET = withActivityLogging(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
        { status: 401 }
      );
    }

    // Get user's email from auth
    const userEmail = user.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'User email not found') },
        { status: 400 }
      );
    }

    const result = await teamService.getUserInvitations(userEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to get invitations') },
        { status: 500 }
      );
    }

    return NextResponse.json({ invitations: result.invitations });

  } catch (error: any) {
    console.error('Error getting invitations:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get invitations') },
      { status: 500 }
    );
  }
});

/**
 * POST /api/teams/invitations/accept
 * Accept team invitation
 */
export const POST = withRateLimit('general')(withActivityLogging(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invitationToken } = body;

    if (!invitationToken) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invitation token is required') },
        { status: 400 }
      );
    }

    const result = await teamService.acceptInvitation(invitationToken, user.id, request);

    if (!result.success) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to accept invitation') },
        { status: 500 }
      );
    }

    return NextResponse.json({ team: result.team });

  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to accept invitation') },
      { status: 500 }
    );
  }
}));
