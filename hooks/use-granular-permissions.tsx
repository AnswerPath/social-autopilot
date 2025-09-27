'use client';
import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Permission } from '@/lib/auth-types';

interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  source: 'role' | 'custom' | 'resource' | 'override' | 'denied';
  details?: any;
}

interface GranularPermissionHook {
  // Permission checking
  checkPermission: (
    permission: Permission,
    resourceType?: string,
    resourceId?: string,
    userId?: string
  ) => Promise<PermissionCheckResult>;
  
  hasPermission: (
    permission: Permission,
    resourceType?: string,
    resourceId?: string,
    userId?: string
  ) => Promise<boolean>;
  
  // Resource permissions
  grantResourcePermission: (
    userId: string,
    permission: Permission,
    resourceType: string,
    resourceId: string,
    expiresAt?: string,
    conditions?: any[]
  ) => Promise<any>;
  
  revokeResourcePermission: (permissionId: string) => Promise<void>;
  
  // Permission overrides
  createPermissionOverride: (
    userId: string,
    permission: Permission,
    action: 'grant' | 'deny',
    reason: string,
    resourceType?: string,
    resourceId?: string,
    expiresAt?: string
  ) => Promise<any>;
  
  // Get user permissions
  getUserEffectivePermissions: (
    userId?: string,
    resourceType?: string,
    resourceId?: string
  ) => Promise<any>;
  
  // State
  loading: boolean;
  error: string | null;
}

export function useGranularPermissions(): GranularPermissionHook {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/granular-permissions${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPermission = useCallback(async (
    permission: Permission,
    resourceType?: string,
    resourceId?: string,
    userId?: string
  ): Promise<PermissionCheckResult> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const data = await makeRequest('/check', 'POST', {
      permission,
      resourceType,
      resourceId,
      userId
    });

    return {
      allowed: data.allowed,
      reason: data.reason,
      source: data.source,
      details: data.details
    };
  }, [user, makeRequest]);

  const hasPermission = useCallback(async (
    permission: Permission,
    resourceType?: string,
    resourceId?: string,
    userId?: string
  ): Promise<boolean> => {
    const result = await checkPermission(permission, resourceType, resourceId, userId);
    return result.allowed;
  }, [checkPermission]);

  const grantResourcePermission = useCallback(async (
    userId: string,
    permission: Permission,
    resourceType: string,
    resourceId: string,
    expiresAt?: string,
    conditions?: any[]
  ) => {
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    const data = await makeRequest('/grant-resource', 'PUT', {
      userId,
      permission,
      resourceType,
      resourceId,
      expiresAt,
      conditions
    });

    return data.resourcePermission;
  }, [user, makeRequest]);

  const revokeResourcePermission = useCallback(async (permissionId: string) => {
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    await makeRequest('/resource', 'DELETE', { permissionId });
  }, [user, makeRequest]);

  const createPermissionOverride = useCallback(async (
    userId: string,
    permission: Permission,
    action: 'grant' | 'deny',
    reason: string,
    resourceType?: string,
    resourceId?: string,
    expiresAt?: string
  ) => {
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    const data = await makeRequest('/override', 'PATCH', {
      userId,
      permission,
      action,
      reason,
      resourceType,
      resourceId,
      expiresAt
    });

    return data.permissionOverride;
  }, [user, makeRequest]);

  const getUserEffectivePermissions = useCallback(async (
    userId?: string,
    resourceType?: string,
    resourceId?: string
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const targetUserId = userId || user.id;

    // Users can only view their own permissions unless they're admin
    if (targetUserId !== user.id && user.role !== 'ADMIN') {
      throw new Error('Cannot view other users\' permissions');
    }

    const params = new URLSearchParams();
    if (targetUserId !== user.id) params.append('userId', targetUserId);
    if (resourceType) params.append('resourceType', resourceType);
    if (resourceId) params.append('resourceId', resourceId);

    const endpoint = params.toString() ? `/resource?${params.toString()}` : '/resource';
    const data = await makeRequest(endpoint, 'GET');

    return data.permissions;
  }, [user, makeRequest]);

  return {
    checkPermission,
    hasPermission,
    grantResourcePermission,
    revokeResourcePermission,
    createPermissionOverride,
    getUserEffectivePermissions,
    loading,
    error
  };
}

// Convenience hook for checking specific permissions
export function usePermissionCheck(
  permission: Permission,
  resourceType?: string,
  resourceId?: string
) {
  const { hasPermission, loading, error } = useGranularPermissions();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const checkAccess = useCallback(async () => {
    try {
      const result = await hasPermission(permission, resourceType, resourceId);
      setHasAccess(result);
      return result;
    } catch (err) {
      console.error('Permission check failed:', err);
      setHasAccess(false);
      return false;
    }
  }, [hasPermission, permission, resourceType, resourceId]);

  return {
    hasAccess,
    checkAccess,
    loading,
    error
  };
}
