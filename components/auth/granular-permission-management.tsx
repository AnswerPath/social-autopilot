'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useGranularPermissions } from '@/hooks/use-granular-permissions';
import { Permission, UserRole } from '@/lib/auth-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, CheckCircle, XCircle, Plus, Trash2, Clock, User, Key, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionInfo {
  allowed: boolean;
  reason: string;
  source: string;
  details?: any;
}

interface UserPermissions {
  role: Permission[];
  custom: any[];
  resource: any[];
  overrides: any[];
}

export function GranularPermissionManagement() {
  const { user } = useAuth();
  const {
    checkPermission,
    grantResourcePermission,
    revokeResourcePermission,
    createPermissionOverride,
    getUserEffectivePermissions,
    loading,
    error
  } = useGranularPermissions();

  // State
  const [permissionInfo, setPermissionInfo] = useState<PermissionInfo | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<Permission | ''>('');
  const [resourceType, setResourceType] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);

  // Permission check form
  const [checkForm, setCheckForm] = useState({
    permission: '' as Permission | '',
    resourceType: '',
    resourceId: '',
    userId: ''
  });

  // Grant resource permission form
  const [grantForm, setGrantForm] = useState({
    userId: '',
    permission: '' as Permission | '',
    resourceType: '',
    resourceId: '',
    expiresAt: '',
    conditions: ''
  });

  // Permission override form
  const [overrideForm, setOverrideForm] = useState({
    userId: '',
    permission: '' as Permission | '',
    action: 'grant' as 'grant' | 'deny',
    reason: '',
    resourceType: '',
    resourceId: '',
    expiresAt: ''
  });

  // Check permission
  const handleCheckPermission = async () => {
    if (!checkForm.permission) {
      toast.error('Please select a permission');
      return;
    }

    try {
      const result = await checkPermission(
        checkForm.permission,
        checkForm.resourceType || undefined,
        checkForm.resourceId || undefined,
        checkForm.userId || undefined
      );
      
      setPermissionInfo(result);
      toast.success('Permission check completed');
    } catch (error) {
      toast.error('Failed to check permission');
    }
  };

  // Grant resource permission
  const handleGrantResourcePermission = async () => {
    if (!grantForm.userId || !grantForm.permission || !grantForm.resourceType || !grantForm.resourceId) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const conditions = grantForm.conditions ? JSON.parse(grantForm.conditions) : undefined;
      
      await grantResourcePermission(
        grantForm.userId,
        grantForm.permission,
        grantForm.resourceType,
        grantForm.resourceId,
        grantForm.expiresAt || undefined,
        conditions
      );
      
      toast.success('Resource permission granted successfully');
      setShowGrantDialog(false);
      setGrantForm({
        userId: '',
        permission: '',
        resourceType: '',
        resourceId: '',
        expiresAt: '',
        conditions: ''
      });
      
      // Refresh user permissions
      await loadUserPermissions();
    } catch (error) {
      toast.error('Failed to grant resource permission');
    }
  };

  // Create permission override
  const handleCreatePermissionOverride = async () => {
    if (!overrideForm.userId || !overrideForm.permission || !overrideForm.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await createPermissionOverride(
        overrideForm.userId,
        overrideForm.permission,
        overrideForm.action,
        overrideForm.reason,
        overrideForm.resourceType || undefined,
        overrideForm.resourceId || undefined,
        overrideForm.expiresAt || undefined
      );
      
      toast.success(`Permission ${overrideForm.action} override created successfully`);
      setShowOverrideDialog(false);
      setOverrideForm({
        userId: '',
        permission: '',
        action: 'grant',
        reason: '',
        resourceType: '',
        resourceId: '',
        expiresAt: ''
      });
      
      // Refresh user permissions
      await loadUserPermissions();
    } catch (error) {
      toast.error('Failed to create permission override');
    }
  };

  // Load user permissions
  const loadUserPermissions = async () => {
    if (!user) return;

    try {
      const permissions = await getUserEffectivePermissions(
        targetUserId || undefined,
        resourceType || undefined,
        resourceId || undefined
      );
      
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    }
  };

  // Revoke resource permission
  const handleRevokeResourcePermission = async (permissionId: string) => {
    try {
      await revokeResourcePermission(permissionId);
      toast.success('Resource permission revoked successfully');
      await loadUserPermissions();
    } catch (error) {
      toast.error('Failed to revoke resource permission');
    }
  };

  // Load permissions on mount and when filters change
  useEffect(() => {
    loadUserPermissions();
  }, [targetUserId, resourceType, resourceId, user]);

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>Please log in to view granular permission management.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (user.role !== UserRole.ADMIN) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>Admin access required to manage granular permissions.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Granular Permission Management
          </CardTitle>
          <CardDescription>
            Manage fine-grained permissions, resource-specific access, and permission overrides.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="check" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="check">Check Permission</TabsTrigger>
              <TabsTrigger value="grant">Grant Resource</TabsTrigger>
              <TabsTrigger value="override">Create Override</TabsTrigger>
              <TabsTrigger value="view">View Permissions</TabsTrigger>
            </TabsList>

            {/* Permission Check Tab */}
            <TabsContent value="check" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="check-permission">Permission</Label>
                  <Select value={checkForm.permission} onValueChange={(value) => setCheckForm(prev => ({ ...prev, permission: value as Permission }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select permission" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(Permission).map((permission) => (
                        <SelectItem key={permission} value={permission}>
                          {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="check-user-id">User ID (optional)</Label>
                  <Input
                    id="check-user-id"
                    value={checkForm.userId}
                    onChange={(e) => setCheckForm(prev => ({ ...prev, userId: e.target.value }))}
                    placeholder="User ID to check"
                  />
                </div>
                <div>
                  <Label htmlFor="check-resource-type">Resource Type (optional)</Label>
                  <Input
                    id="check-resource-type"
                    value={checkForm.resourceType}
                    onChange={(e) => setCheckForm(prev => ({ ...prev, resourceType: e.target.value }))}
                    placeholder="e.g., post, media, team"
                  />
                </div>
                <div>
                  <Label htmlFor="check-resource-id">Resource ID (optional)</Label>
                  <Input
                    id="check-resource-id"
                    value={checkForm.resourceId}
                    onChange={(e) => setCheckForm(prev => ({ ...prev, resourceId: e.target.value }))}
                    placeholder="Resource ID"
                  />
                </div>
              </div>
              
              <Button onClick={handleCheckPermission} disabled={loading || !checkForm.permission}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check Permission
              </Button>

              {permissionInfo && (
                <Alert>
                  <div className="flex items-center gap-2">
                    {permissionInfo.allowed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription>
                      <strong>Result:</strong> {permissionInfo.allowed ? 'Allowed' : 'Denied'}<br />
                      <strong>Reason:</strong> {permissionInfo.reason}<br />
                      <strong>Source:</strong> {permissionInfo.source}
                    </AlertDescription>
                  </div>
                </Alert>
              )}
            </TabsContent>

            {/* Grant Resource Permission Tab */}
            <TabsContent value="grant" className="space-y-4">
              <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Grant Resource Permission
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Grant Resource Permission</DialogTitle>
                    <DialogDescription>
                      Grant a specific permission for a user on a particular resource.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="grant-user-id">User ID</Label>
                      <Input
                        id="grant-user-id"
                        value={grantForm.userId}
                        onChange={(e) => setGrantForm(prev => ({ ...prev, userId: e.target.value }))}
                        placeholder="User ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="grant-permission">Permission</Label>
                      <Select value={grantForm.permission} onValueChange={(value) => setGrantForm(prev => ({ ...prev, permission: value as Permission }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select permission" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(Permission).map((permission) => (
                            <SelectItem key={permission} value={permission}>
                              {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="grant-resource-type">Resource Type</Label>
                      <Input
                        id="grant-resource-type"
                        value={grantForm.resourceType}
                        onChange={(e) => setGrantForm(prev => ({ ...prev, resourceType: e.target.value }))}
                        placeholder="e.g., post, media, team"
                      />
                    </div>
                    <div>
                      <Label htmlFor="grant-resource-id">Resource ID</Label>
                      <Input
                        id="grant-resource-id"
                        value={grantForm.resourceId}
                        onChange={(e) => setGrantForm(prev => ({ ...prev, resourceId: e.target.value }))}
                        placeholder="Resource ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="grant-expires">Expires At (optional)</Label>
                      <Input
                        id="grant-expires"
                        type="datetime-local"
                        value={grantForm.expiresAt}
                        onChange={(e) => setGrantForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="grant-conditions">Conditions (JSON, optional)</Label>
                      <Textarea
                        id="grant-conditions"
                        value={grantForm.conditions}
                        onChange={(e) => setGrantForm(prev => ({ ...prev, conditions: e.target.value }))}
                        placeholder='[{"type": "time", "operator": "greater_than", "value": "2024-01-01T00:00:00Z"}]'
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleGrantResourcePermission} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Grant Permission
                      </Button>
                      <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Permission Override Tab */}
            <TabsContent value="override" className="space-y-4">
              <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    Create Permission Override
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Permission Override</DialogTitle>
                    <DialogDescription>
                      Create a permission override to grant or deny specific permissions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="override-user-id">User ID</Label>
                      <Input
                        id="override-user-id"
                        value={overrideForm.userId}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, userId: e.target.value }))}
                        placeholder="User ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="override-permission">Permission</Label>
                      <Select value={overrideForm.permission} onValueChange={(value) => setOverrideForm(prev => ({ ...prev, permission: value as Permission }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select permission" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(Permission).map((permission) => (
                            <SelectItem key={permission} value={permission}>
                              {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="override-action">Action</Label>
                      <Select value={overrideForm.action} onValueChange={(value) => setOverrideForm(prev => ({ ...prev, action: value as 'grant' | 'deny' }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grant">Grant</SelectItem>
                          <SelectItem value="deny">Deny</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="override-reason">Reason</Label>
                      <Textarea
                        id="override-reason"
                        value={overrideForm.reason}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="Reason for this override"
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="override-resource-type">Resource Type (optional)</Label>
                      <Input
                        id="override-resource-type"
                        value={overrideForm.resourceType}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, resourceType: e.target.value }))}
                        placeholder="e.g., post, media, team"
                      />
                    </div>
                    <div>
                      <Label htmlFor="override-resource-id">Resource ID (optional)</Label>
                      <Input
                        id="override-resource-id"
                        value={overrideForm.resourceId}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, resourceId: e.target.value }))}
                        placeholder="Resource ID"
                      />
                    </div>
                    <div>
                      <Label htmlFor="override-expires">Expires At (optional)</Label>
                      <Input
                        id="override-expires"
                        type="datetime-local"
                        value={overrideForm.expiresAt}
                        onChange={(e) => setOverrideForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreatePermissionOverride} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Override
                      </Button>
                      <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* View Permissions Tab */}
            <TabsContent value="view" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="view-user-id">User ID (optional)</Label>
                  <Input
                    id="view-user-id"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="User ID to view"
                  />
                </div>
                <div>
                  <Label htmlFor="view-resource-type">Resource Type (optional)</Label>
                  <Input
                    id="view-resource-type"
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value)}
                    placeholder="e.g., post, media, team"
                  />
                </div>
                <div>
                  <Label htmlFor="view-resource-id">Resource ID (optional)</Label>
                  <Input
                    id="view-resource-id"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    placeholder="Resource ID"
                  />
                </div>
              </div>

              <Button onClick={loadUserPermissions} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load Permissions
              </Button>

              {userPermissions && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Role Permissions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userPermissions.role.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Custom Permissions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userPermissions.custom.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Resource Permissions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userPermissions.resource.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Overrides</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userPermissions.overrides.length}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {userPermissions.resource.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Resource Permissions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Permission</TableHead>
                              <TableHead>Resource</TableHead>
                              <TableHead>Expires</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userPermissions.resource.map((perm) => (
                              <TableRow key={perm.id}>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {perm.permission.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {perm.resource_type}: {perm.resource_id}
                                </TableCell>
                                <TableCell>
                                  {perm.expires_at ? (
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(perm.expires_at).toLocaleDateString()}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Never</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRevokeResourcePermission(perm.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {error && (
            <Alert className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
