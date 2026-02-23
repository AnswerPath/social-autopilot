'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
  AccountSettings as AccountSettingsType, 
  NotificationPreferences, 
  SecuritySettings, 
  AccountPreferences,
  SessionInfo,
  PasswordChangeRequest,
  AccountDeletionRequest 
} from '@/lib/auth-types';

type AccountSettingsContextValue = {
  user: ReturnType<typeof useAuth>['user'];
  loading: boolean;
  error: string | null;
  settings: AccountSettingsType | null;
  sessions: SessionInfo[];
  fetchSettings: () => Promise<unknown>;
  updateNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<AccountSettingsType | void>;
  updateSecuritySettings: (security: Partial<SecuritySettings>) => Promise<AccountSettingsType | void>;
  updateAccountPreferences: (preferences: Partial<AccountPreferences>) => Promise<AccountSettingsType | void>;
  changePassword: (passwordData: PasswordChangeRequest) => Promise<unknown>;
  revokeSession: (sessionId: string) => Promise<unknown>;
  deleteAccount: (deletionData: AccountDeletionRequest) => Promise<unknown>;
};

const AccountSettingsContext = createContext<AccountSettingsContextValue | null>(null);

export function AccountSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AccountSettingsType | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const loading = loadingCount > 0;

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to fetch account settings');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const updateNotificationPreferences = useCallback(async (preferences: Partial<NotificationPreferences>) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to update notification preferences');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const updateSecuritySettings = useCallback(async (security: Partial<SecuritySettings>) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to update security settings');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const updateAccountPreferences = useCallback(async (preferences: Partial<AccountPreferences>) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to update account preferences');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const changePassword = useCallback(async (passwordData: PasswordChangeRequest) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to change password');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const revokeSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user, fetchSettings]);

  const deleteAccount = useCallback(async (deletionData: AccountDeletionRequest) => {
    if (!user) return;
    setLoadingCount((c) => c + 1);
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
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      throw err;
    } finally {
      setLoadingCount((c) => Math.max(0, c - 1));
    }
  }, [user]);

  const value = useMemo<AccountSettingsContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <AccountSettingsContext.Provider value={value}>
      {children}
    </AccountSettingsContext.Provider>
  );
}

export function useAccountSettings() {
  const context = useContext(AccountSettingsContext);
  if (!context) {
    throw new Error('useAccountSettings must be used within an AccountSettingsProvider');
  }
  return context;
}
