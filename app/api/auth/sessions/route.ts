import { NextRequest, NextResponse } from 'next/server';
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { 
  getUserSessionsDetailed,
  getSessionAnalytics,
  deactivateSession,
  deactivateOtherSessions,
  cleanupExpiredSessions
} from '@/lib/session-management';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Get user sessions with enhanced details
 * GET /api/auth/sessions
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
      const includeAnalytics = searchParams.get('analytics') === 'true';
      const currentSessionId = req.cookies.get('sb-session-id')?.value;

      // Get detailed session information
      const sessions = await getUserSessionsDetailed(user.id);
      
      // Mark current session
      const sessionsWithCurrent = sessions.map(session => ({
        ...session,
        is_current: session.session_id === currentSessionId
      }));

      const response: any = {
        sessions: sessionsWithCurrent,
        total: sessions.length,
        active: sessions.filter(s => s.is_active).length
      };

      // Include analytics if requested
      if (includeAnalytics) {
        response.analytics = await getSessionAnalytics(user.id);
      }

      return NextResponse.json(response);

    } catch (error) {
      console.error('Get sessions error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get sessions') },
        { status: 500 }
      );
    }
  });
}

/**
 * Deactivate a specific session
 * DELETE /api/auth/sessions?sessionId=<id>
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

      const { searchParams } = new URL(req.url);
      const sessionId = searchParams.get('sessionId');
      const deactivateOthers = searchParams.get('others') === 'true';
      const currentSessionId = req.cookies.get('sb-session-id')?.value;

      if (deactivateOthers) {
        // Deactivate all other sessions
        if (!currentSessionId) {
          return NextResponse.json(
            { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'No current session found') },
            { status: 401 }
          );
        }

        const deactivatedCount = await deactivateOtherSessions(
          user.id, 
          currentSessionId,
          'user_requested'
        );

        return NextResponse.json({
          message: `Deactivated ${deactivatedCount} other sessions`,
          deactivatedCount
        });

      } else if (sessionId) {
        // Deactivate specific session
        const success = await deactivateSession(sessionId, 'user_requested');
        
        if (!success) {
          return NextResponse.json(
            { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to deactivate session') },
            { status: 500 }
          );
        }

        return NextResponse.json({
          message: 'Session deactivated successfully'
        });

      } else {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Session ID or "others" parameter required') },
          { status: 400 }
        );
      }

    } catch (error) {
      console.error('Deactivate session error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to deactivate session') },
        { status: 500 }
      );
    }
  });
}

/**
 * Clean up expired sessions (admin endpoint)
 * POST /api/auth/sessions/cleanup
 */
export async function POST(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const user = await getCurrentUser(req);
      
      if (!user || user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Admin access required') },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action');

      if (action === 'cleanup') {
        const cleanedCount = await cleanupExpiredSessions();
        
        return NextResponse.json({
          message: `Cleaned up ${cleanedCount} expired sessions`,
          cleanedCount
        });
      }

      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid action') },
        { status: 400 }
      );

    } catch (error) {
      console.error('Session cleanup error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to cleanup sessions') },
        { status: 500 }
      );
    }
  });
}