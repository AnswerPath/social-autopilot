'use client';
import { useAuth } from '@/hooks/use-auth';
import { Permission, PermissionCheck } from '@/lib/auth-types';
import { useState, useCallback } from 'react';

/**
 * Hook for checking granular permissions
 */
export function usePermissionCheck() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check a single permission
   */
  const checkPermission = useCallback(async (
    permission: Permission,
    resourceId?: string,
    context?: Record<string, any>
  ): Promise<PermissionCheck> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/permissions/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: permission,
          resourceId,
          context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check permission');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check multiple permissions at once
   */
  const checkMultiplePermissions = useCallback(async (
    permissions: Permission[],
    resourceId?: string,
    context?: Record<string, any>
  ): Promise<Record<Permission, boolean>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/permissions/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions,
          resourceId,
          context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check permissions');
      }

      const data = await response.json();
      return data.permissions;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get user's permission information
   */
  const getPermissionInfo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/permissions');
      
      if (!response.ok) {
        throw new Error('Failed to get permission info');
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    error,
    checkPermission,
    checkMultiplePermissions,
    getPermissionInfo
  };
}

/**
 * Hook for checking if user has a specific permission (client-side only)
 */
export function useHasPermission(permission: Permission) {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}

/**
 * Hook for checking if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: Permission[]) {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }

  return permissions.some(permission => user.permissions.includes(permission));
}

/**
 * Hook for checking if user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: Permission[]) {
  const { user } = useAuth();
  
  if (!user) {
    return false;
  }

  return permissions.every(permission => user.permissions.includes(permission));
}
