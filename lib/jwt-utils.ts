import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AuthErrorType } from '@/lib/auth-types';

// JWT token validation and management utilities
export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  needsRefresh: boolean;
  userId?: string;
  error?: string;
  expiresAt?: number;
}

export interface TokenRefreshResult {
  success: boolean;
  newAccessToken?: string;
  newRefreshToken?: string;
  expiresAt?: number;
  error?: string;
}

export interface TokenRevocationResult {
  success: boolean;
  error?: string;
}

/**
 * Validate a JWT access token
 */
export async function validateAccessToken(token: string): Promise<TokenValidationResult> {
  try {
    if (!token) {
      return {
        isValid: false,
        isExpired: false,
        needsRefresh: false,
        error: 'No token provided'
      };
    }

    // Verify token with Supabase
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
    
    if (error) {
      return {
        isValid: false,
        isExpired: error.message.includes('expired') || error.message.includes('invalid'),
        needsRefresh: !error.message.includes('expired'),
        error: error.message
      };
    }

    if (!user) {
      return {
        isValid: false,
        isExpired: false,
        needsRefresh: false,
        error: 'User not found'
      };
    }

    // Check if token is close to expiry (within 5 minutes)
    const tokenExpiry = user.exp || 0;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = tokenExpiry - now;
    const needsRefresh = timeUntilExpiry < 300; // 5 minutes

    return {
      isValid: true,
      isExpired: false,
      needsRefresh,
      userId: user.id,
      expiresAt: tokenExpiry
    };
  } catch (error) {
    console.error('Token validation error:', error);
    return {
      isValid: false,
      isExpired: false,
      needsRefresh: false,
      error: 'Token validation failed'
    };
  }
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
  try {
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token provided'
      };
    }

    // Refresh token with Supabase
    const { data, error } = await getSupabaseAdmin().auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      return {
        success: false,
        error: error?.message || 'Token refresh failed'
      };
    }

    return {
      success: true,
      newAccessToken: data.session.access_token,
      newRefreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      error: 'Token refresh failed'
    };
  }
}

/**
 * Revoke a refresh token (logout)
 */
export async function revokeRefreshToken(refreshToken: string): Promise<TokenRevocationResult> {
  try {
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token provided'
      };
    }

    // Revoke token with Supabase
    const { error } = await getSupabaseAdmin().auth.signOut({
      refresh_token: refreshToken
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Token revocation error:', error);
    return {
      success: false,
      error: 'Token revocation failed'
    };
  }
}

/**
 * Revoke all tokens for a user (security incident)
 */
export async function revokeAllUserTokens(userId: string): Promise<TokenRevocationResult> {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'No user ID provided'
      };
    }

    // Deactivate all sessions in database
    await getSupabaseAdmin()
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Note: Supabase doesn't have a direct API to revoke all tokens for a user
    // The session deactivation above will prevent access via our session management
    // For complete token revocation, you might need to implement additional measures

    return {
      success: true
    };
  } catch (error) {
    console.error('Revoke all tokens error:', error);
    return {
      success: false,
      error: 'Failed to revoke all tokens'
    };
  }
}

/**
 * Check if a token is close to expiry and needs refresh
 */
export function isTokenNearExpiry(token: string): boolean {
  try {
    // Decode JWT payload (without verification for expiry check)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    
    // Refresh if token expires within 5 minutes
    return timeUntilExpiry < 300;
  } catch (error) {
    return true; // If we can't decode, assume it needs refresh
  }
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp;
  } catch (error) {
    return null;
  }
}

/**
 * Extract user ID from token
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || payload.user_id;
  } catch (error) {
    return null;
  }
}

/**
 * Create a secure token validation middleware
 */
export function createTokenValidationMiddleware() {
  return async (request: NextRequest): Promise<{ isValid: boolean; user?: any; error?: string }> => {
    try {
      const token = request.cookies.get('sb-auth-token')?.value;
      
      if (!token) {
        return { isValid: false, error: 'No access token found' };
      }

      const validation = await validateAccessToken(token);
      
      if (!validation.isValid) {
        return { 
          isValid: false, 
          error: validation.error || 'Invalid token' 
        };
      }

      if (validation.needsRefresh) {
        // Try to refresh the token
        const refreshToken = request.cookies.get('sb-refresh-token')?.value;
        if (refreshToken) {
          const refreshResult = await refreshAccessToken(refreshToken);
          if (refreshResult.success) {
            // Token was refreshed, continue with new token
            return { 
              isValid: true, 
              user: { id: validation.userId },
              error: 'Token refreshed' 
            };
          }
        }
        
        return { 
          isValid: false, 
          error: 'Token needs refresh but refresh failed' 
        };
      }

      return { 
        isValid: true, 
        user: { id: validation.userId } 
      };
    } catch (error) {
      console.error('Token validation middleware error:', error);
      return { 
        isValid: false, 
        error: 'Token validation failed' 
      };
    }
  };
}
