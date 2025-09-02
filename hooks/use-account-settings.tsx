'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
  AccountSettings, 
  NotificationPreferences, 
  SecuritySettings, 
  AccountPreferences,
  SessionInfo,
  PasswordChangeRequest,
  AccountDeletionRequest 
} from '@/lib/auth-types';

export function useAccountSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch account settings');
      }
      const data = await response.json();
      setSettings(data.settings);
      setSessions(data.sessions || []);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch account settings';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateNotificationPreferences = useCallback(async (preferences: Partial<NotificationPreferences>) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: preferences }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update notification preferences');
      }
      const data = await response.json();
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update notification preferences';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateSecuritySettings = useCallback(async (security: Partial<SecuritySettings>) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ security_settings: security }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update security settings');
      }
      const data = await response.json();
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update security settings';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateAccountPreferences = useCallback(async (preferences: Partial<AccountPreferences>) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_preferences: preferences }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account preferences');
      }
      const data = await response.json();
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update account preferences';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const changePassword = useCallback(async (passwordData: PasswordChangeRequest) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }
      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke session');
      }
      // Refresh sessions list
      await fetchSettings();
      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke session';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, fetchSettings]);

  const deleteAccount = useCallback(async (deletionData: AccountDeletionRequest) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/account-settings/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deletionData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }
      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    user,
    loading,
    error,
    settings,
    sessions,
    fetchSettings,
    updateNotificationPreferences,
    updateSecuritySettings,
    updateAccountPreferences,
    changePassword,
    revokeSession,
    deleteAccount,
  };
}
