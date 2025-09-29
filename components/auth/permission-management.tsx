'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissionCheck } from '@/hooks/use-permissions';
import { Permission, UserRole } from '@/lib/auth-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, CheckCircle, XCircle, Info } from 'lucide-react';

interface PermissionInfo {
  user: {
    id: string;
    email: string;
    role: UserRole;
    permissions: Permission[];
  };
  permissions: {
    userPermissions: Permission[];
    rolePermissions: Permission[];
    allPermissions: Record<Permission, string>;
  };
  role: {
    current: UserRole;
    available: UserRole[];
  };
}

export function PermissionManagement() {
  const { user } = useAuth();
  const { loading, error, getPermissionInfo } = usePermissionCheck();
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (user) {
      loadPermissionInfo();
    }
  }, [user]);

  const loadPermissionInfo = async () => {
    try {
      const info = await getPermissionInfo();
      setPermissionInfo(info);
    } catch (error) {
      console.error('Failed to load permission info:', error);
    }
  };

  const handlePermissionToggle = (permission: Permission) => {
    setSelectedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const getPermissionCategory = (permission: Permission): string => {
    if (permission.includes('POST')) return 'Post Management';
    if (permission.includes('MEDIA') || permission.includes('CONTENT')) return 'Content Management';
    if (permission.includes('ANALYTICS') || permission.includes('EXPORT') || permission.includes('REPORTS')) return 'Analytics & Reporting';
    if (permission.includes('USER')) return 'User Management';
    if (permission.includes('SETTING') || permission.includes('INTEGRATION') || permission.includes('LOG')) return 'Settings & Configuration';
    if (permission.includes('TEAM') || permission.includes('MEMBER')) return 'Team Management';
    if (permission.includes('AUTOMATION') || permission.includes('REPLY') || permission.includes('SCHEDULING')) return 'Automation';
    if (permission.includes('BILLING') || permission.includes('SUBSCRIPTION')) return 'Billing & Subscription';
    if (permission.includes('API')) return 'API Access';
    return 'Other';
  };

  const getPermissionDescription = (permission: Permission): string => {
    // Convert permission enum to human-readable description
    return permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const groupedPermissions = permissionInfo && permissionInfo.userPermissions ? 
    permissionInfo.userPermissions.reduce((acc, permission) => {
      const category = getPermissionCategory(permission);
      if (!acc[category]) acc[category] = [];
      acc[category].push({ permission, description: getPermissionDescription(permission) });
      return acc;
    }, {} as Record<string, Array<{ permission: Permission; description: string }>>) : {};

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Please log in to view permission information.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading permission information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Error loading permission information: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Information
          </CardTitle>
          <CardDescription>
            Current user permissions and role information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">User Details</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Email:</strong> {user?.email}</p>
                <div className="flex items-center"><strong>Role:</strong> 
                  <Badge variant="secondary" className="ml-2">
                    {permissionInfo?.userRole}
                  </Badge>
                </div>
                <p><strong>Permissions:</strong> {permissionInfo?.userPermissions?.length || 0} total</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Role Permissions</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Role:</strong> {permissionInfo?.userRole}</p>
                <p><strong>Available Roles:</strong> ADMIN, EDITOR, VIEWER</p>
                <p><strong>Role Permissions:</strong> {permissionInfo?.userPermissions?.length || 0} total</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Categories</CardTitle>
          <CardDescription>
            Browse permissions by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={Object.keys(groupedPermissions)[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {Object.keys(groupedPermissions).map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <TabsContent key={category} value={category}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {permissions.map(({ permission, description }) => {
                    const hasPermission = permissionInfo?.userPermissions?.includes(permission);
                    const isRolePermission = permissionInfo?.userPermissions?.includes(permission);
                    
                    return (
                      <Card key={permission} className="relative">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{permission}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {hasPermission ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex gap-1">
                            {hasPermission && (
                              <Badge variant="outline" className="text-xs">
                                User
                              </Badge>
                            )}
                            {isRolePermission && (
                              <Badge variant="secondary" className="text-xs">
                                Role
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Permission Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Testing</CardTitle>
          <CardDescription>
            Test specific permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Select Permissions to Test</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.values(Permission).slice(0, 12).map((permission) => (
                  <Button
                    key={permission}
                    variant={selectedPermissions.includes(permission) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePermissionToggle(permission)}
                    className="justify-start"
                  >
                    {permission}
                  </Button>
                ))}
              </div>
            </div>
            
            {selectedPermissions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Selected Permissions</h4>
                <div className="space-y-2">
                  {selectedPermissions.map((permission) => {
                    const hasPermission = permissionInfo?.userPermissions?.includes(permission);
                    return (
                      <div key={permission} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{permission}</span>
                        <Badge variant={hasPermission ? "default" : "destructive"}>
                          {hasPermission ? "Granted" : "Denied"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
