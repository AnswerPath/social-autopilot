import { NextRequest, NextResponse } from 'next/server';
import { 
  validateAccessToken,
  refreshAccessToken,
  isTokenNearExpiry
} from '@/lib/jwt-utils';
import { 
  updateSessionActivity,
  getSessionDetails
} from '@/lib/session-management';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';
import { withRateLimit } from '@/lib/rate-limiting';
import { logAuthEvent, ActivityLevel } from '@/lib/activity-logging';

/**
 * Enhanced token refresh endpoint with security checks
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  return withRateLimit('tokenRefresh')(request, async (req) => {
    try {
      const accessToken = req.cookies.get('sb-auth-token')?.value;
      const refreshToken = req.cookies.get('sb-refresh-token')?.value;
      const sessionId = req.cookies.get('sb-session-id')?.value;

      if (!accessToken || !refreshToken) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'Missing tokens') },
          { status: 401 }
        );
      }

      // Validate current access token
      const tokenValidation = await validateAccessToken(accessToken);
      
      if (!tokenValidation.isValid && !tokenValidation.isExpired) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'Invalid access token') },
          { status: 401 }
        );
      }

      // Check if token actually needs refresh
      if (!tokenValidation.needsRefresh && !tokenValidation.isExpired) {
        // Token is still valid, just update session activity
        if (sessionId) {
          await updateSessionActivity(sessionId, req);
        }
        
        return NextResponse.json({
          message: 'Token is still valid',
          token: accessToken,
          expiresAt: tokenValidation.expiresAt
        });
      }

      // Attempt to refresh the token
      const refreshResult = await refreshAccessToken(refreshToken);
      
      if (!refreshResult.success) {
        // Log failed token refresh
        if (tokenValidation.userId) {
          await logAuthEvent(
            tokenValidation.userId,
            'token_refresh_failed',
            false,
            { reason: 'Token refresh failed', sessionId },
            req
          );
        }
        
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'Token refresh failed') },
          { status: 401 }
        );
      }
      
      // Log successful token refresh
      if (tokenValidation.userId) {
        await logAuthEvent(
          tokenValidation.userId,
          'token_refresh_success',
          true,
          { sessionId, tokenExpired: tokenValidation.isExpired },
          req
        );
      }

      // Update session activity
      if (sessionId) {
        const sessionUpdate = await updateSessionActivity(sessionId, req);
        
        // Check for security alerts
        if (sessionUpdate.securityAlert) {
          console.warn('Security alert during token refresh:', sessionUpdate.securityAlert);
          // In production, you might want to send alerts or take additional security measures
        }
      }

      // Create response with new tokens
      const response = NextResponse.json({
        message: 'Token refreshed successfully',
        token: refreshResult.newAccessToken,
        expiresAt: refreshResult.expiresAt
      });

      // Set new access token cookie
      response.cookies.set('sb-auth-token', refreshResult.newAccessToken!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 // 1 hour
      });

      // Set new refresh token cookie if provided
      if (refreshResult.newRefreshToken) {
        response.cookies.set('sb-refresh-token', refreshResult.newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 // 7 days
        });
      }

      return response;

    } catch (error) {
      console.error('Token refresh error:', error);
      
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
        { status: 500 }
      );
    }
  });
}

/**
 * Check token status without refreshing
 * GET /api/auth/refresh
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('sb-auth-token')?.value;
    const sessionId = request.cookies.get('sb-session-id')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'No access token') },
        { status: 401 }
      );
    }

    // Validate token
    const tokenValidation = await validateAccessToken(accessToken);
    
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'Invalid token') },
        { status: 401 }
      );
    }

    // Get session details if available
    let sessionDetails = null;
    if (sessionId) {
      sessionDetails = await getSessionDetails(sessionId);
    }

    return NextResponse.json({
      valid: true,
      needsRefresh: tokenValidation.needsRefresh,
      expiresAt: tokenValidation.expiresAt,
      session: sessionDetails ? {
        id: sessionDetails.session_id,
        lastActivity: sessionDetails.last_activity,
        ipAddress: sessionDetails.ip_address,
        deviceType: sessionDetails.device_type,
        browser: sessionDetails.browser,
        os: sessionDetails.os
      } : null
    });

  } catch (error) {
    console.error('Token status check error:', error);
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    );
  }
}