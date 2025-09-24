'use client';

import { useState, useCallback } from 'react';
import { UserRole, Permission } from '@/lib/auth-types';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  permissionCount: number;
  isDefault: boolean;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedAt: string;
  assignedBy: string;
}

interface PermissionInfo {
  id: Permission;
  name: string;
  category: string;
  description: string;
  isDangerous: boolean;
}

interface RoleManagementHook {
  // Data
  roles: Role[];
  users: User[];
  permissions: PermissionInfo[];
  loading: boolean;
  error: string | null;

  // Role management
  createRole: (roleData: { name: string; description: string; permissions: Permission[] }) => Promise<void>;
  updateRole: (roleId: string, roleData: { name?: string; description?: string; permissions?: Permission[] }) => Promise<void>;
  deleteRole: (roleId: string) => Promise<void>;

  // User role management
  assignRole: (userId: string, roleId: string) => Promise<void>;
  removeRole: (userId: string) => Promise<void>;
  checkUserPermission: (userId: string, permission: Permission) => Promise<boolean>;

  // Utility functions
  refreshData: () => Promise<void>;
  clearError: () => void;
}

export function useRoleManagement(): RoleManagementHook {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    console.error('Role management error:', err);
    setError(err instanceof Error ? err.message : 'An unexpected error occurred');
  }, []);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [rolesResponse, usersResponse, permissionsResponse] = await Promise.all([
        fetch('/api/auth/roles'),
        fetch('/api/auth/users'),
        fetch('/api/auth/permissions')
      ]);

      if (!rolesResponse.ok || !usersResponse.ok || !permissionsResponse.ok) {
        throw new Error('Failed to load role management data');
      }

      const [rolesData, usersData, permissionsData] = await Promise.all([
        rolesResponse.json(),
        usersResponse.json(),
        permissionsResponse.json()
      ]);

      setRoles(rolesData.roles || []);
      setUsers(usersData.users || []);
      setPermissions(permissionsData.permissions || []);

    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  const createRole = useCallback(async (roleData: { name: string; description: string; permissions: Permission[] }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create role');
      }

      await refreshData();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [refreshData, handleError]);

  const updateRole = useCallback(async (roleId: string, roleData: { name?: string; description?: string; permissions?: Permission[] }) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId,
          ...roleData
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update role');
      }

      await refreshData();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [refreshData, handleError]);

  const deleteRole = useCallback(async (roleId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/auth/roles?roleId=${roleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete role');
      }

      await refreshData();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [refreshData, handleError]);

  const assignRole = useCallback(async (userId: string, roleId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/users/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roleId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to assign role');
      }

      await refreshData();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [refreshData, handleError]);

  const removeRole = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/auth/users/roles?userId=${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to remove role');
      }

      await refreshData();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [refreshData, handleError]);

  const checkUserPermission = useCallback(async (userId: string, permission: Permission): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          permission
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to check permission');
      }

      const data = await response.json();
      return data.hasPermission;
    } catch (err) {
      handleError(err);
      return false;
    }
  }, [handleError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Data
    roles,
    users,
    permissions,
    loading,
    error,

    // Role management
    createRole,
    updateRole,
    deleteRole,

    // User role management
    assignRole,
    removeRole,
    checkUserPermission,

    // Utility functions
    refreshData,
    clearError
  };
}

// Utility hook for checking permissions
export function usePermissionCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkPermission = useCallback(async (permission: Permission, userId?: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission,
          userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to check permission');
      }

      const data = await response.json();
      return data.hasPermission;
    } catch (err) {
      console.error('Permission check error:', err);
      setError(err instanceof Error ? err.message : 'Failed to check permission');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    checkPermission,
    loading,
    error,
    clearError
  };
}

// Utility hook for role information
export function useRoleInfo() {
  const [roleInfo, setRoleInfo] = useState<{
    user: { id: string; name: string; email: string };
    role: { id: string; assignedAt: string; assignedBy: string };
    permissions: Array<{ id: Permission; name: string; category: string }>;
    permissionCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserRole = useCallback(async (userId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const url = userId ? `/api/auth/users/roles?userId=${userId}` : '/api/auth/users/roles';
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get user role');
      }

      const data = await response.json();
      setRoleInfo(data);
    } catch (err) {
      console.error('Get user role error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get user role');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    roleInfo,
    getUserRole,
    loading,
    error,
    clearError
  };
}

