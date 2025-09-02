'use client'

import React from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePermission, useRole } from '@/hooks/use-auth'
import { Permission, UserRole } from '@/lib/auth-types'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: Permission
  requiredRole?: UserRole
  fallback?: React.ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  requiredPermission, 
  requiredRole, 
  fallback,
  redirectTo = '/auth'
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const hasPermission = usePermission(requiredPermission || '')
  const hasRole = useRole(requiredRole || '')

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Check if user is authenticated
  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }
    // Redirect to auth page
    window.location.href = redirectTo
    return null
  }

  // Check if user has required permission
  if (requiredPermission && !hasPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    )
  }

  // Check if user has required role
  if (requiredRole && !hasRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have the required role to access this page.
          </p>
        </div>
      </div>
    )
  }

  // User is authenticated and has required permissions/role
  return <>{children}</>
}

// Convenience components for common protection patterns
export function AdminOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole={UserRole.ADMIN} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

export function EditorOnly({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole={UserRole.EDITOR} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

export function CanCreatePost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requiredPermission={Permission.CREATE_POST} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

export function CanManageUsers({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requiredPermission={Permission.MANAGE_USERS} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}
