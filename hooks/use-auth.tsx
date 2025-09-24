'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthState, AuthUser, LoginRequest, RegisterRequest } from '@/lib/auth-types'

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>
  register: (userData: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  // Check for existing session on mount
  useEffect(() => {
    refreshSession()
  }, [])

  const refreshSession = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setState({
          user: data.user,
          session: data.session,
          loading: false,
          error: null
        })
      } else if (response.status === 401) {
        // Try to refresh the token
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        })

        if (refreshResponse.ok) {
          // Token refreshed, try to get session again
          const sessionResponse = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include'
          })

          if (sessionResponse.ok) {
            const data = await sessionResponse.json()
            setState({
              user: data.user,
              session: data.session,
              loading: false,
              error: null
            })
          } else {
            setState({
              user: null,
              session: null,
              loading: false,
              error: null
            })
          }
        } else {
          setState({
            user: null,
            session: null,
            loading: false,
            error: null
          })
        }
      } else {
        setState({
          user: null,
          session: null,
          loading: false,
          error: null
        })
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      setState({
        user: null,
        session: null,
        loading: false,
        error: 'Failed to refresh session'
      })
    }
  }

  const login = async (credentials: LoginRequest) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed')
      }

      setState({
        user: data.user,
        session: data.session,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Login error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }))
      throw error
    }
  }

  const register = async (userData: RegisterRequest) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Registration failed')
      }

      setState({
        user: data.user,
        session: data.session,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Registration error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }))
      throw error
    }
  }

  const logout = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      setState({
        user: null,
        session: null,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Logout error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Logout failed'
      }))
    }
  }

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshSession
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook to check if user has a specific permission
export function usePermission(permission: string) {
  const { user } = useAuth()
  return user?.permissions.includes(permission) || false
}

// Hook to check if user has a specific role
export function useRole(role: string) {
  const { user } = useAuth()
  return user?.role === role
}

// Hook to check if user is admin
export function useIsAdmin() {
  const { user } = useAuth()
  return user?.role === 'admin'
}
