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

export function useProfile() {
  const { user, refreshSession } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  /** Block profile fetch after 401 until user identity changes (stops retry loop) */
  const profile401BlockRef = useRef(false);

  // Reset stored profile and 401 block when auth user changes so stale async results cannot overwrite state
  useEffect(() => {
    const userId = user?.id ?? null;
    if (userId !== lastUserIdRef.current) {
      lastUserIdRef.current = userId;
      profile401BlockRef.current = false;
      setProfile(null);
      setError(null);
    }
  }, [user?.id]);

  /**
   * Fetch user profile
   */
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    if (profile401BlockRef.current) return;

    const existing = profileFetchInflight.get(user.id);
    if (existing) {
      setLoading(true);
      try {
        const data = await existing;
        if (lastUserIdRef.current === (user?.id ?? null)) {
          setProfile(data?.profile ?? null);
        }
        return data;
      } finally {
        setLoading(false);
      }
    }

    const promise = (async (): Promise<ProfileData | undefined> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/profile', { credentials: 'include' });

        if (response.status === 401) {
          profile401BlockRef.current = true;
          setError('Session expired');
          const restored = await refreshSession();
          if (restored) {
            profile401BlockRef.current = false;
            setError(null);
            const retryResponse = await fetch('/api/profile', { credentials: 'include' });
            if (retryResponse.status === 401) {
              profile401BlockRef.current = true;
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
      } finally {
        setLoading(false);
        profileFetchInflight.delete(user.id);
      }
    })();

    profileFetchInflight.set(user.id, promise);
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
