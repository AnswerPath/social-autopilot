'use client';
import { useState, useCallback } from 'react';
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

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user profile
   */
  const fetchProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile');
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data: ProfileData = await response.json();
      setProfile(data.profile);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

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
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update profile');
      }

      const data = await response.json();
      setProfile(data.profile);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
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
      setError(errorMessage);
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
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete avatar');
      }

      // Update local state
      if (profile) {
        setProfile({ ...profile, avatar_url: undefined });
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
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
