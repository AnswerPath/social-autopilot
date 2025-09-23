import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { 
  revokeRefreshToken,
  revokeAllUserTokens
} from '@/lib/jwt-utils';
import { 
  deactivateSession,
  deactivateOtherSessions
} from '@/lib/session-management';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Revoke tokens and sessions for security incidents
 * POST /api/auth/revoke
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
      const { 
        action, 
        sessionId, 
        reason = 'security_incident',
        revokeAll = false 
      } = body;

      const currentSessionId = req.cookies.get('sb-session-id')?.value;
      const refreshToken = req.cookies.get('sb-refresh-token')?.value;

      switch (action) {
        case 'revoke_session':
          if (!sessionId) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Session ID required') },
              { status: 400 }
            );
          }

          const success = await deactivateSession(sessionId, reason);
          
          if (!success) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to revoke session') },
              { status: 500 }
            );
          }

          return NextResponse.json({
            message: 'Session revoked successfully',
            sessionId
          });

        case 'revoke_other_sessions':
          if (!currentSessionId) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'No current session found') },
              { status: 401 }
            );
          }

          const deactivatedCount = await deactivateOtherSessions(
            user.id, 
            currentSessionId,
            reason
          );

          return NextResponse.json({
            message: `Revoked ${deactivatedCount} other sessions`,
            deactivatedCount
          });

        case 'revoke_all_tokens':
          if (!refreshToken) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'No refresh token found') },
              { status: 401 }
            );
          }

          // Revoke refresh token
          const revokeResult = await revokeRefreshToken(refreshToken);
          
          if (!revokeResult.success) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to revoke tokens') },
              { status: 500 }
            );
          }

          // Revoke all user sessions
          const allTokensResult = await revokeAllUserTokens(user.id);
          
          if (!allTokensResult.success) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to revoke all tokens') },
              { status: 500 }
            );
          }

          // Clear cookies
          const response = NextResponse.json({
            message: 'All tokens and sessions revoked successfully'
          });

          response.cookies.delete('sb-auth-token');
          response.cookies.delete('sb-refresh-token');
          response.cookies.delete('sb-session-id');

          return response;

        case 'emergency_revoke':
          // Emergency revocation - revoke everything immediately
          if (user.role !== 'ADMIN') {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Admin access required for emergency revocation') },
              { status: 403 }
            );
          }

          const emergencyResult = await revokeAllUserTokens(user.id);
          
          if (!emergencyResult.success) {
            return NextResponse.json(
              { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Emergency revocation failed') },
              { status: 500 }
            );
          }

          const emergencyResponse = NextResponse.json({
            message: 'Emergency revocation completed',
            timestamp: new Date().toISOString()
          });

          // Clear all cookies
          emergencyResponse.cookies.delete('sb-auth-token');
          emergencyResponse.cookies.delete('sb-refresh-token');
          emergencyResponse.cookies.delete('sb-session-id');

          return emergencyResponse;

        default:
          return NextResponse.json(
            { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid action') },
            { status: 400 }
          );
      }

    } catch (error) {
      console.error('Token revocation error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Get revocation status
 * GET /api/auth/revoke
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

      const currentSessionId = req.cookies.get('sb-session-id')?.value;
      const accessToken = req.cookies.get('sb-auth-token')?.value;
      const refreshToken = req.cookies.get('sb-refresh-token')?.value;

      return NextResponse.json({
        hasActiveSession: !!currentSessionId,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        sessionId: currentSessionId,
        userId: user.id,
        role: user.role,
        canRevokeAll: user.role === 'ADMIN',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Revocation status error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}
