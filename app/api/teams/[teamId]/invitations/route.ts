import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import type { TeamInvitation } from '@/lib/team-types';

function sanitizeInvitation(inv: TeamInvitation) {
  const { invitation_token: _token, ...rest } = inv;
  return rest;
}

/**
 * GET /api/teams/[teamId]/invitations
 * List pending invitations for this team (inviters with canInviteMembers).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
        { status: 401 }
      );
    }

    const { teamId } = await params;
    const result = await teamService.getPendingInvitationsForTeam(teamId, user.id);

    if (!result.success) {
      const status = result.error === 'Insufficient permissions' ? 403 : 500;
      const errType =
        result.error === 'Insufficient permissions'
          ? AuthErrorType.INSUFFICIENT_PERMISSIONS
          : AuthErrorType.NETWORK_ERROR;
      return NextResponse.json(
        { error: createAuthError(errType, result.error || 'Failed to list invitations') },
        { status }
      );
    }

    const invitations = (result.invitations || []).map(sanitizeInvitation);
    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('GET /api/teams/[teamId]/invitations', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to list invitations') },
      { status: 500 }
    );
  }
}
