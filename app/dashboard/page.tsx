'use client'

import React from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { 
  CanCreatePost, 
  CanEditPost, 
  CanDeletePost, 
  CanViewAnalytics, 
  CanManageUsers,
  CanManageSettings 
} from '@/components/auth/permission-gate'
import { RoleManagement } from '@/components/auth/role-management'
import { PermissionManagement } from '@/components/auth/permission-management'
import { GranularPermissionManagement } from '@/components/auth/granular-permission-management'
import { ActivityLogsDashboard } from '@/components/auth/activity-logs-dashboard'
import { TeamDashboard } from '@/components/auth/team-dashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Shield, Plus, Edit, Trash2, BarChart3, Settings, Users } from 'lucide-react'
import Link from 'next/link'

function DashboardContent() {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome to Social AutoPilot</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                User Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-sm">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Display Name</p>
                <p className="text-sm">{user?.profile?.display_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                <Badge variant="secondary" className="capitalize">
                  {user?.role}
                </Badge>
              </div>
              
              {/* Action Buttons - Centered within the card content */}
              <div className="flex justify-center gap-2 pt-4 border-t">
                <Link href="/profile">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Profile
                  </Button>
                </Link>
                <Link href="/account-settings">
                  <Button variant="outline" size="sm">
                    Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Permissions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {user?.permissions.map((permission) => (
                  <Badge key={permission} variant="outline" className="mr-2 mb-2">
                    {permission}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you can perform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <CanCreatePost>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </CanCreatePost>
              
              <CanEditPost>
                <Button variant="outline" className="w-full justify-start">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Posts
                </Button>
              </CanEditPost>
              
              <CanDeletePost>
                <Button variant="outline" className="w-full justify-start">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Posts
                </Button>
              </CanDeletePost>
              
              <CanViewAnalytics>
                <Link href="/analytics">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Analytics
                  </Button>
                </Link>
              </CanViewAnalytics>
              
              <CanManageUsers>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
              </CanManageUsers>
              
              <CanManageSettings>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Settings
                </Button>
              </CanManageSettings>
            </CardContent>
          </Card>
        </div>

        {/* Role Management Section */}
        <CanManageUsers>
          <div className="mb-8">
            <RoleManagement />
          </div>
        </CanManageUsers>

        {/* Permission Management Section */}
        <div className="mb-8">
          <PermissionManagement />
        </div>

        {/* Granular Permission Management Section */}
        <CanManageUsers>
          <div className="mb-8">
            <GranularPermissionManagement />
          </div>
        </CanManageUsers>

        {/* Activity Logs Dashboard Section */}
        <CanManageUsers>
          <div className="mb-8">
            <ActivityLogsDashboard />
          </div>
        </CanManageUsers>

        {/* Team Collaboration Dashboard Section */}
        <div className="mb-8">
          <TeamDashboard />
        </div>

        {/* Permission Demo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Demonstration</CardTitle>
            <CardDescription>
              This section shows how different permissions control access to features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Post Creation</h4>
                <CanCreatePost>
                  <p className="text-green-600 text-sm">✅ You can create posts</p>
                </CanCreatePost>
                <CanCreatePost fallback={<p className="text-red-600 text-sm">❌ You cannot create posts</p>}>
                  <p className="text-green-600 text-sm">✅ You can create posts</p>
                </CanCreatePost>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Analytics Access</h4>
                <CanViewAnalytics>
                  <p className="text-green-600 text-sm">✅ You can view analytics</p>
                </CanViewAnalytics>
                <CanViewAnalytics fallback={<p className="text-red-600 text-sm">❌ You cannot view analytics</p>}>
                  <p className="text-green-600 text-sm">✅ You can view analytics</p>
                </CanViewAnalytics>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">User Management</h4>
                <CanManageUsers>
                  <p className="text-green-600 text-sm">✅ You can manage users</p>
                </CanManageUsers>
                <CanManageUsers fallback={<p className="text-red-600 text-sm">❌ You cannot manage users</p>}>
                  <p className="text-green-600 text-sm">✅ You can manage users</p>
                </CanManageUsers>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Settings Management</h4>
                <CanManageSettings>
                  <p className="text-green-600 text-sm">✅ You can manage settings</p>
                </CanManageSettings>
                <CanManageSettings fallback={<p className="text-red-600 text-sm">❌ You cannot manage settings</p>}>
                  <p className="text-green-600 text-sm">✅ You can manage settings</p>
                </CanManageSettings>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
