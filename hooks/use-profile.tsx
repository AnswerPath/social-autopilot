'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { UserProfile } from '@/lib/auth-types';

interface ProfileData {
  profile: UserProfile | null;
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  bio?: string;
  timezone?: string;
  email_notifications?: boolean;
  avatar_url?: string;
}

interface AvatarUploadData {
  fileName: string;
  fileType: string;
  fileSize: number;
}

/** Module-scoped dedup: one in-flight profile fetch per user across all useProfile() instances */
const profileFetchInflight = new Map<string, Promise<ProfileData | undefined>>();
/**
 * Module-scoped 401 blocker: prevent retry loops per user across all useProfile() instances.
 * Values are timestamps (in ms since epoch) indicating when the block expires.
 */
const profile401BlockByUserId = new Map<string, number>();

const PROFILE_401_BASE_BACKOFF_MS = 30_000;
const PROFILE_401_MAX_BACKOFF_MS = 5 * 60_000;

function scheduleProfile401Backoff(userId: string) {
  const now = Date.now();
  const currentExpiry = profile401BlockByUserId.get(userId);

  let nextBackoffMs = PROFILE_401_BASE_BACKOFF_MS;
  if (currentExpiry && currentExpiry > now) {
    const remainingMs = currentExpiry - now;
    nextBackoffMs = Math.min(remainingMs * 2, PROFILE_401_MAX_BACKOFF_MS);
  }

  profile401BlockByUserId.set(userId, now + nextBackoffMs);
}

export function useProfile() {
  const { user, refreshSession } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  // Reset stored profile and 401 block when auth user changes so stale async results cannot overwrite state
  useEffect(() => {
    const newUserId = user?.id ?? null;
    const previousUserId = lastUserIdRef.current;
    if (newUserId !== previousUserId) {
      // Clear any 401 block for the previous user id so new sessions aren't blocked
      if (previousUserId) {
        profile401BlockByUserId.delete(previousUserId);
      }
      lastUserIdRef.current = newUserId;
      setProfile(null);
      setLoading(false);
      setError(null);
    }
  }, [user?.id]);

  /**
   * Fetch user profile
   */
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const blockUntil = profile401BlockByUserId.get(user.id);
    const now = Date.now();
    if (blockUntil && blockUntil > now) {
      return;
    }
    if (blockUntil && blockUntil <= now) {
      profile401BlockByUserId.delete(user.id);
    }

    const existing = profileFetchInflight.get(user.id);
    if (existing) {
      setLoading(true);
      try {
        setError(null);
        const startedFor = user.id;
        const data = await existing;
        if (lastUserIdRef.current === (user?.id ?? null) && lastUserIdRef.current === startedFor) {
          setProfile(data?.profile ?? null);
        }
        return data;
      } catch (err) {
        if (lastUserIdRef.current === (user?.id ?? null)) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
        }
        throw err;
      } finally {
        if (lastUserIdRef.current === (user?.id ?? null)) {
          setLoading(false);
        }
      }
    }

    const startedFor = user.id;
    setLoading(true);
    setError(null);

    const promise = (async (): Promise<ProfileData | undefined> => {
      try {
        const response = await fetch('/api/profile', { credentials: 'include' });

        if (response.status === 401) {
          // Set or extend a cooldown to avoid tight 401 retry loops.
          scheduleProfile401Backoff(user.id);
          setError('Session expired');
          const restored = await refreshSession();
          if (restored) {
            profile401BlockByUserId.delete(user.id);
            setError(null);
            const retryResponse = await fetch('/api/profile', { credentials: 'include' });
            if (retryResponse.status === 401) {
              scheduleProfile401Backoff(user.id);
              setError('Session expired');
              return undefined;
            }
            if (!retryResponse.ok) {
              throw new Error('Failed to fetch profile');
            }
            const retryData: ProfileData = await retryResponse.json();
            if (lastUserIdRef.current === user.id) {
              setProfile(retryData.profile);
            }
            return retryData;
          }
          return undefined;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data: ProfileData = await response.json();
        if (lastUserIdRef.current === user.id) {
          setProfile(data.profile);
        }
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (lastUserIdRef.current === (user?.id ?? null)) {
          setError(errorMessage);
        }
        throw err;
      }
    })();

    profileFetchInflight.set(startedFor, promise);
    promise.finally(() => {
      if (lastUserIdRef.current === (user?.id ?? null) && lastUserIdRef.current === startedFor) {
        setLoading(false);
      }
      const current = profileFetchInflight.get(startedFor);
      if (current === promise) {
        profileFetchInflight.delete(startedFor);
      }
    });

    return promise;
  }, [user, refreshSession]);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updateData: ProfileUpdateData) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update profile');
      }

      const data = await response.json();
      if (lastUserIdRef.current === (user?.id ?? null)) {
        setProfile(data.profile);
      }
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (lastUserIdRef.current === (user?.id ?? null)) {
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Upload avatar
   */
  const uploadAvatar = useCallback(async (file: File) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get presigned URL
      const uploadData: AvatarUploadData = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(uploadData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get upload URL');
      }

      const { uploadUrl, fileName, token } = await response.json();

      // Step 2: Upload file using presigned URL
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Update profile with new avatar URL
      const avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-avatars/${fileName}`;
      
      const updateResponse = await updateProfile({ avatar_url: avatarUrl });
      
      return updateResponse;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (lastUserIdRef.current === (user?.id ?? null)) {
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, updateProfile]);

  /**
   * Delete avatar
   */
  const deleteAvatar = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete avatar');
      }

      // Update local state
      if (profile && lastUserIdRef.current === (user?.id ?? null)) {
        setProfile({ ...profile, avatar_url: undefined });
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (lastUserIdRef.current === (user?.id ?? null)) {
        setError(errorMessage);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  /**
   * Get avatar URL with fallback
   */
  const getAvatarUrl = useCallback((size: number = 40) => {
    if (profile?.avatar_url) {
      return `${profile.avatar_url}?width=${size}&height=${size}&resize=cover`;
    }
    
    // Return default avatar or initials
    return `https://ui-avatars.com/api/?name=${profile?.display_name || user?.email}&size=${size}&background=random`;
  }, [profile, user]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    deleteAvatar,
    getAvatarUrl,
  };
}
