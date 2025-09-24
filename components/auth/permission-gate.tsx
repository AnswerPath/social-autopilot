'use client'

import React from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Permission } from '@/lib/auth-types'

interface PermissionGateProps {
  children: React.ReactNode
  permission: Permission
  fallback?: React.ReactNode
  showFallback?: boolean
}

export function PermissionGate({ 
  children, 
  permission, 
  fallback = null,
  showFallback = false 
}: PermissionGateProps) {
  const { user } = useAuth()
  
  const hasPermission = user?.permissions.includes(permission) || false

  if (!hasPermission) {
    return showFallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

interface PermissionButtonProps {
  children: React.ReactNode
  permission: Permission
  onClick?: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function PermissionButton({ 
  children, 
  permission, 
  onClick,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = ''
}: PermissionButtonProps) {
  const { user } = useAuth()
  
  const hasPermission = user?.permissions.includes(permission) || false
  const isDisabled = disabled || !hasPermission

  return (
    <button
      onClick={hasPermission ? onClick : undefined}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background ${className}`}
      title={!hasPermission ? `Requires permission: ${permission}` : undefined}
    >
      {children}
    </button>
  )
}

interface PermissionSectionProps {
  children: React.ReactNode
  permission: Permission
  fallback?: React.ReactNode
  showFallback?: boolean
  className?: string
}

export function PermissionSection({ 
  children, 
  permission, 
  fallback = null,
  showFallback = false,
  className = ''
}: PermissionSectionProps) {
  const { user } = useAuth()
  
  const hasPermission = user?.permissions.includes(permission) || false

  if (!hasPermission) {
    return showFallback ? <div className={className}>{fallback}</div> : null
  }

  return <div className={className}>{children}</div>
}

// Convenience components for common permissions
export function CanCreatePost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.CREATE_POST} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanEditPost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.EDIT_POST} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanDeletePost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.DELETE_POST} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanApprovePost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.APPROVE_POST} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanSchedulePost({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.SCHEDULE_POST} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanViewAnalytics({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.VIEW_ANALYTICS} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanManageUsers({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.MANAGE_USERS} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}

export function CanManageSettings({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  return (
    <PermissionGate permission={Permission.MANAGE_SETTINGS} fallback={fallback}>
      {children}
    </PermissionGate>
  )
}
