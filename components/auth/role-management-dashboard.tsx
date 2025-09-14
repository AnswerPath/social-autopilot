'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
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

export function RoleManagementDashboard() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('roles');

  // Role management state
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[]
  });

  // User management state
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [rolesResponse, usersResponse, permissionsResponse] = await Promise.all([
        fetch('/api/auth/roles'),
        fetch('/api/auth/users'),
        fetch('/api/auth/permissions')
      ]);

      if (!rolesResponse.ok || !usersResponse.ok || !permissionsResponse.ok) {
        throw new Error('Failed to load data');
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
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      const response = await fetch('/api/auth/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create role');
      }

      await loadData();
      setIsCreateRoleOpen(false);
      setNewRole({ name: '', description: '', permissions: [] });
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const handleEditRole = async () => {
    if (!editingRole) return;

    try {
      const response = await fetch('/api/auth/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: editingRole.id,
          name: newRole.name,
          description: newRole.description,
          permissions: newRole.permissions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update role');
      }

      await loadData();
      setIsEditRoleOpen(false);
      setEditingRole(null);
      setNewRole({ name: '', description: '', permissions: [] });
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const response = await fetch(`/api/auth/roles?roleId=${roleId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete role');
      }

      await loadData();
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      const response = await fetch('/api/auth/users/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          roleId: selectedRole
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to assign role');
      }

      await loadData();
      setIsAssignRoleOpen(false);
      setSelectedUser(null);
      setSelectedRole('');
    } catch (err) {
      console.error('Error assigning role:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/users/roles?userId=${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to remove role');
      }

      await loadData();
    } catch (err) {
      console.error('Error removing role:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove role');
    }
  };

  const togglePermission = (permission: Permission) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setNewRole({
      name: role.name,
      description: role.description,
      permissions: role.permissions
    });
    setIsEditRoleOpen(true);
  };

  const openAssignRole = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setIsAssignRoleOpen(true);
  };

  const getPermissionCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Post Management': 'bg-blue-100 text-blue-800',
      'Content Management': 'bg-green-100 text-green-800',
      'Analytics & Reporting': 'bg-purple-100 text-purple-800',
      'User Management': 'bg-red-100 text-red-800',
      'Settings & Configuration': 'bg-yellow-100 text-yellow-800',
      'Team Management': 'bg-indigo-100 text-indigo-800',
      'Automation': 'bg-pink-100 text-pink-800',
      'Billing & Subscription': 'bg-orange-100 text-orange-800',
      'API Access': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (user?.role !== UserRole.ADMIN) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You need admin privileges to access the role management dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading role management data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Role Management</h2>
          <p className="text-muted-foreground">
            Manage user roles, permissions, and access control
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">System Roles</h3>
            <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                  <DialogDescription>
                    Create a custom role with specific permissions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="roleName">Role Name</Label>
                    <Input
                      id="roleName"
                      value={newRole.name}
                      onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter role name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="roleDescription">Description</Label>
                    <Textarea
                      id="roleDescription"
                      value={newRole.description}
                      onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter role description"
                    />
                  </div>
                  <div>
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-4">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={permission.id}
                            checked={newRole.permissions.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                            className="rounded"
                          />
                          <label htmlFor={permission.id} className="text-sm">
                            {permission.name}
                            {permission.isDangerous && (
                              <AlertTriangle className="h-3 w-3 inline ml-1 text-red-500" />
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole}>
                    Create Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {role.name}
                        {role.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                        {role.isCustom && (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditRole(role)}
                        disabled={role.isDefault}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={role.isDefault}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the role "{role.name}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRole(role.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {role.permissionCount} permissions
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 5).map((permission) => {
                        const permissionInfo = permissions.find(p => p.id === permission);
                        return (
                          <Badge
                            key={permission}
                            className={getPermissionCategoryColor(permissionInfo?.category || 'Other')}
                            variant="secondary"
                          >
                            {permissionInfo?.name || permission}
                          </Badge>
                        );
                      })}
                      {role.permissions.length > 5 && (
                        <Badge variant="outline">
                          +{role.permissions.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <h3 className="text-lg font-semibold">User Role Assignments</h3>
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {user.name}
                      </CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignRole(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove the role from "{user.name}"? 
                              They will lose all associated permissions.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveRole(user.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remove Role
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.role}</Badge>
                    <span className="text-sm text-muted-foreground">
                      Assigned {new Date(user.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <h3 className="text-lg font-semibold">System Permissions</h3>
          <div className="grid gap-4">
            {permissions.reduce((acc, permission) => {
              const category = permission.category;
              if (!acc[category]) {
                acc[category] = [];
              }
              acc[category].push(permission);
              return acc;
            }, {} as Record<string, PermissionInfo[]>).map(([category, categoryPermissions]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {category}
                    <Badge variant="outline">
                      {categoryPermissions.length} permissions
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {categoryPermissions.map((permission) => (
                      <div key={permission.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{permission.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {permission.description}
                          </div>
                        </div>
                        {permission.isDangerous && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Dangerous
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Modify the role permissions and details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editRoleName">Role Name</Label>
              <Input
                id="editRoleName"
                value={newRole.name}
                onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter role name"
              />
            </div>
            <div>
              <Label htmlFor="editRoleDescription">Description</Label>
              <Textarea
                id="editRoleDescription"
                value={newRole.description}
                onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter role description"
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-4">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`edit-${permission.id}`}
                      checked={newRole.permissions.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                      className="rounded"
                    />
                    <label htmlFor={`edit-${permission.id}`} className="text-sm">
                      {permission.name}
                      {permission.isDangerous && (
                        <AlertTriangle className="h-3 w-3 inline ml-1 text-red-500" />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRole}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="roleSelect">Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignRoleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignRole}>
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
