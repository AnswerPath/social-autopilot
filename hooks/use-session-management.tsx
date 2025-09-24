'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { toast } from 'sonner';

interface SessionInfo {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  expires_at: string;
  device_type?: string;
  browser?: string;
  os?: string;
  is_current?: boolean;
}

interface TokenStatus {
  valid: boolean;
  needsRefresh: boolean;
  expiresAt?: number;
  session?: {
    id: string;
    lastActivity: string;
    ipAddress: string;
    deviceType: string;
    browser: string;
    os: string;
  };
}

interface SessionManagementHook {
  // Session data
  sessions: SessionInfo[];
  currentSession: SessionInfo | null;
  tokenStatus: TokenStatus | null;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  
  // Actions
  refreshSessions: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  revokeOtherSessions: () => Promise<number>;
  checkTokenStatus: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  
  // Utilities
  isTokenExpired: boolean;
  needsTokenRefresh: boolean;
}

export function useSessionManagement(): SessionManagementHook {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh token status periodically
  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      await checkTokenStatus();
    };

    // Check immediately
    checkStatus();

    // Check every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Auto-refresh token if needed
  useEffect(() => {
    if (tokenStatus?.needsRefresh && !refreshing) {
      refreshToken();
    }
  }, [tokenStatus?.needsRefresh]);

  const refreshSessions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/sessions?analytics=true');
      const data = await response.json();
      
      if (response.ok) {
        const sessionList = data.sessions || [];
        setSessions(sessionList);
        
        // Find current session
        const current = sessionList.find((s: SessionInfo) => s.is_current);
        setCurrentSession(current || null);
      } else {
        toast.error(data.error || 'Failed to load sessions');
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const revokeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Session revoked successfully');
        await refreshSessions();
        return true;
      } else {
        toast.error(data.error || 'Failed to revoke session');
        return false;
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
      return false;
    }
  }, [refreshSessions]);

  const revokeOtherSessions = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/auth/sessions?others=true', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const count = data.deactivatedCount || 0;
        toast.success(`Revoked ${count} other sessions`);
        await refreshSessions();
        return count;
      } else {
        toast.error(data.error || 'Failed to revoke other sessions');
        return 0;
      }
    } catch (error) {
      console.error('Error revoking other sessions:', error);
      toast.error('Failed to revoke other sessions');
      return 0;
    }
  }, [refreshSessions]);

  const checkTokenStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh');
      const data = await response.json();
      
      if (response.ok) {
        setTokenStatus({
          valid: data.valid,
          needsRefresh: data.needsRefresh,
          expiresAt: data.expiresAt,
          session: data.session
        });
      } else {
        setTokenStatus({
          valid: false,
          needsRefresh: false
        });
      }
    } catch (error) {
      console.error('Error checking token status:', error);
      setTokenStatus({
        valid: false,
        needsRefresh: false
      });
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTokenStatus(prev => prev ? {
          ...prev,
          valid: true,
          needsRefresh: false,
          expiresAt: data.expiresAt
        } : null);
        
        return true;
      } else {
        // Token refresh failed, user needs to re-authenticate
        setTokenStatus({
          valid: false,
          needsRefresh: false
        });
        
        toast.error('Session expired. Please log in again.');
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      setTokenStatus({
        valid: false,
        needsRefresh: false
      });
      
      toast.error('Failed to refresh session');
      return false;
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load sessions when user changes
  useEffect(() => {
    if (user) {
      refreshSessions();
    } else {
      setSessions([]);
      setCurrentSession(null);
      setTokenStatus(null);
    }
  }, [user, refreshSessions]);

  return {
    // Session data
    sessions,
    currentSession,
    tokenStatus,
    
    // Loading states
    loading,
    refreshing,
    
    // Actions
    refreshSessions,
    revokeSession,
    revokeOtherSessions,
    checkTokenStatus,
    refreshToken,
    
    // Utilities
    isTokenExpired: tokenStatus ? !tokenStatus.valid : false,
    needsTokenRefresh: tokenStatus?.needsRefresh || false
  };
}
