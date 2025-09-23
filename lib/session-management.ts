import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AuthErrorType } from '@/lib/auth-types';

// Enhanced session management utilities
export interface SessionDetails {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  expires_at: string;
  location?: string;
  device_type?: string;
  browser?: string;
  os?: string;
}

export interface SessionAnalytics {
  total_sessions: number;
  active_sessions: number;
  expired_sessions: number;
  sessions_by_device: Record<string, number>;
  sessions_by_location: Record<string, number>;
  average_session_duration: number;
  concurrent_sessions: number;
}

export interface SessionSecurityEvent {
  event_type: 'suspicious_activity' | 'concurrent_limit_exceeded' | 'unusual_location' | 'device_change';
  session_id: string;
  user_id: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

/**
 * Get detailed session information
 */
export async function getSessionDetails(sessionId: string): Promise<SessionDetails | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('user_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      device_type: getDeviceType(data.user_agent),
      browser: getBrowser(data.user_agent),
      os: getOperatingSystem(data.user_agent)
    };
  } catch (error) {
    console.error('Error getting session details:', error);
    return null;
  }
}

/**
 * Get all sessions for a user with enhanced details
 */
export async function getUserSessionsDetailed(userId: string): Promise<SessionDetails[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('last_activity', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(session => ({
      ...session,
      device_type: getDeviceType(session.user_agent),
      browser: getBrowser(session.user_agent),
      os: getOperatingSystem(session.user_agent)
    }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

/**
 * Create a new session with enhanced tracking
 */
export async function createEnhancedSession(
  userId: string,
  request: NextRequest,
  sessionId?: string
): Promise<string> {
  try {
    const id = sessionId || generateSecureSessionId();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ipAddress = getClientIP(request);
    const location = await getLocationFromIP(ipAddress);
    
    const sessionData = {
      session_id: id,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      is_active: true,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };

    await getSupabaseAdmin()
      .from('user_sessions')
      .insert(sessionData);

    // Check for security events
    await checkSessionSecurity(userId, sessionData, request);

    return id;
  } catch (error) {
    console.error('Error creating enhanced session:', error);
    throw error;
  }
}

/**
 * Update session activity with security checks
 */
export async function updateSessionActivity(
  sessionId: string,
  request: NextRequest
): Promise<{ success: boolean; securityAlert?: SessionSecurityEvent }> {
  try {
    const session = await getSessionDetails(sessionId);
    if (!session) {
      return { success: false };
    }

    const newIP = getClientIP(request);
    const newUserAgent = request.headers.get('user-agent') || 'unknown';

    // Check for suspicious activity
    let securityAlert: SessionSecurityEvent | undefined;

    if (session.ip_address !== newIP) {
      securityAlert = {
        event_type: 'unusual_location',
        session_id: sessionId,
        user_id: session.user_id,
        details: {
          old_ip: session.ip_address,
          new_ip: newIP,
          old_location: session.location,
          new_location: await getLocationFromIP(newIP)
        },
        severity: 'medium',
        created_at: new Date().toISOString()
      };
    }

    if (session.user_agent !== newUserAgent) {
      securityAlert = {
        event_type: 'device_change',
        session_id: sessionId,
        user_id: session.user_id,
        details: {
          old_user_agent: session.user_agent,
          new_user_agent: newUserAgent
        },
        severity: 'high',
        created_at: new Date().toISOString()
      };
    }

    // Update session
    await getSupabaseAdmin()
      .from('user_sessions')
      .update({
        last_activity: new Date().toISOString(),
        ip_address: newIP,
        user_agent: newUserAgent
      })
      .eq('session_id', sessionId);

    // Log security event if detected
    if (securityAlert) {
      await logSecurityEvent(securityAlert);
    }

    return { success: true, securityAlert };
  } catch (error) {
    console.error('Error updating session activity:', error);
    return { success: false };
  }
}

/**
 * Deactivate a specific session
 */
export async function deactivateSession(sessionId: string, reason?: string): Promise<boolean> {
  try {
    await getSupabaseAdmin()
      .from('user_sessions')
      .update({ 
        is_active: false,
        last_activity: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    // Log session deactivation
    const session = await getSessionDetails(sessionId);
    if (session) {
      await logSecurityEvent({
        event_type: 'suspicious_activity',
        session_id: sessionId,
        user_id: session.user_id,
        details: { reason: reason || 'manual_deactivation' },
        severity: 'low',
        created_at: new Date().toISOString()
      });
    }

    return true;
  } catch (error) {
    console.error('Error deactivating session:', error);
    return false;
  }
}

/**
 * Deactivate all sessions for a user except the current one
 */
export async function deactivateOtherSessions(
  userId: string, 
  currentSessionId: string,
  reason?: string
): Promise<number> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('user_sessions')
      .update({ 
        is_active: false,
        last_activity: new Date().toISOString()
      })
      .eq('user_id', userId)
      .neq('session_id', currentSessionId)
      .eq('is_active', true)
      .select('session_id');

    if (error) {
      throw error;
    }

    // Log security event
    await logSecurityEvent({
      event_type: 'suspicious_activity',
      session_id: currentSessionId,
      user_id: userId,
      details: { 
        reason: reason || 'deactivate_other_sessions',
        deactivated_sessions: data?.length || 0
      },
      severity: 'medium',
      created_at: new Date().toISOString()
    });

    return data?.length || 0;
  } catch (error) {
    console.error('Error deactivating other sessions:', error);
    return 0;
  }
}

/**
 * Get session analytics for a user
 */
export async function getSessionAnalytics(userId: string): Promise<SessionAnalytics> {
  try {
    const { data: sessions } = await getSupabaseAdmin()
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId);

    if (!sessions || sessions.length === 0) {
      return {
        total_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        sessions_by_device: {},
        sessions_by_location: {},
        average_session_duration: 0,
        concurrent_sessions: 0
      };
    }

    const now = new Date();
    const activeSessions = sessions.filter(s => s.is_active && new Date(s.expires_at) > now);
    const expiredSessions = sessions.filter(s => !s.is_active || new Date(s.expires_at) <= now);

    // Calculate device distribution
    const deviceCounts: Record<string, number> = {};
    sessions.forEach(session => {
      const deviceType = getDeviceType(session.user_agent);
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
    });

    // Calculate average session duration
    const durations = sessions
      .filter(s => s.last_activity && s.created_at)
      .map(s => new Date(s.last_activity).getTime() - new Date(s.created_at).getTime());
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length / (1000 * 60) // in minutes
      : 0;

    return {
      total_sessions: sessions.length,
      active_sessions: activeSessions.length,
      expired_sessions: expiredSessions.length,
      sessions_by_device: deviceCounts,
      sessions_by_location: {}, // Would need IP geolocation service
      average_session_duration: Math.round(averageDuration),
      concurrent_sessions: activeSessions.length
    };
  } catch (error) {
    console.error('Error getting session analytics:', error);
    return {
      total_sessions: 0,
      active_sessions: 0,
      expired_sessions: 0,
      sessions_by_device: {},
      sessions_by_location: {},
      average_session_duration: 0,
      concurrent_sessions: 0
    };
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('user_sessions')
      .update({ is_active: false })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('session_id');

    if (error) {
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

// Helper functions

function generateSecureSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const cryptoPart = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
  return `sess_${timestamp}_${randomPart}_${cryptoPart}`;
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown';
}

function getDeviceType(userAgent: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(userAgent)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(userAgent)) {
    return 'tablet';
  }
  return 'desktop';
}

function getBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}

function getOperatingSystem(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Unknown';
}

async function getLocationFromIP(ip: string): Promise<string> {
  // In a real implementation, you would use a geolocation service
  // For now, return a placeholder
  return 'Unknown';
}

async function checkSessionSecurity(
  userId: string,
  sessionData: any,
  request: NextRequest
): Promise<void> {
  try {
    // Check for concurrent session limits
    const { data: activeSessions } = await getSupabaseAdmin()
      .from('user_sessions')
      .select('session_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    const maxConcurrentSessions = 5; // Configurable limit
    if (activeSessions && activeSessions.length >= maxConcurrentSessions) {
      await logSecurityEvent({
        event_type: 'concurrent_limit_exceeded',
        session_id: sessionData.session_id,
        user_id: userId,
        details: {
          concurrent_sessions: activeSessions.length,
          limit: maxConcurrentSessions
        },
        severity: 'high',
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error checking session security:', error);
  }
}

async function logSecurityEvent(event: SessionSecurityEvent): Promise<void> {
  try {
    // In a real implementation, you would log to a security events table
    console.log('Security Event:', event);
    
    // You could also send alerts, notifications, etc.
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}
