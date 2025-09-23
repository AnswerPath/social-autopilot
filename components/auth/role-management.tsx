'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useIsAdmin } from '@/hooks/use-auth'
import { UserRole } from '@/lib/auth-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Users, Shield, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  role: UserRole
  profile?: {
    first_name?: string
    last_name?: string
    display_name?: string
  }
}

interface Role {
  value: UserRole
  label: string
  description: string
  permissions: string[]
}

export function RoleManagement() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
      loadRoles()
    }
  }, [isAdmin])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/auth/roles', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else {
        toast.error('Failed to load users')
      }
    } catch (error) {
      console.error('Load users error:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/auth/roles', {
        method: 'POST',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles)
      } else {
        toast.error('Failed to load roles')
      }
    } catch (error) {
      console.error('Load roles error:', error)
      toast.error('Failed to load roles')
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      setUpdating(userId)
      
      const response = await fetch('/api/auth/roles', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userId, role: newRole })
      })

      if (response.ok) {
        toast.success('User role updated successfully')
        // Update the local state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === userId ? { ...u, role: newRole } : u
          )
        )
      } else {
        const data = await response.json()
        toast.error(data.error?.message || 'Failed to update role')
      }
    } catch (error) {
      console.error('Update role error:', error)
      toast.error('Failed to update role')
    } finally {
      setUpdating(null)
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-red-100 text-red-800 border-red-200'
      case UserRole.EDITOR:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case UserRole.VIEWER:
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'Full access to all features and user management'
      case UserRole.EDITOR:
        return 'Can create, edit, and schedule posts, view analytics'
      case UserRole.VIEWER:
        return 'Can view analytics and read-only access to content'
      default:
        return 'Limited access'
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Role Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              You need administrator privileges to manage user roles.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Role Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading users...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="mr-2 h-5 w-5" />
          Role Management
        </CardTitle>
        <CardDescription>
          Manage user roles and permissions. Only administrators can modify user roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((userItem) => (
            <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="font-medium">
                      {userItem.profile?.display_name || 
                       `${userItem.profile?.first_name || ''} ${userItem.profile?.last_name || ''}`.trim() || 
                       userItem.email}
                    </p>
                    <p className="text-sm text-gray-500">{userItem.email}</p>
                  </div>
                  <Badge className={getRoleBadgeColor(userItem.role)}>
                    {userItem.role}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getRoleDescription(userItem.role)}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select
                  value={userItem.role}
                  onValueChange={(value) => updateUserRole(userItem.id, value as UserRole)}
                  disabled={updating === userItem.id || userItem.id === user?.id}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {updating === userItem.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                
                {userItem.id === user?.id && (
                  <Badge variant="outline" className="text-xs">
                    Current User
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Role Descriptions</h4>
          <div className="space-y-2 text-sm">
            {roles.map((role) => (
              <div key={role.value} className="flex items-start space-x-2">
                <Badge className={getRoleBadgeColor(role.value)}>
                  {role.label}
                </Badge>
                <span className="text-gray-600">{role.description}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
