/**
 * Development-only authentication utilities for testing without Supabase
 * This file provides mock authentication for when Supabase is not available
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthUser, UserRole, Permission, ROLE_PERMISSIONS } from '@/lib/auth-types'

// Mock user data for development - ADMIN with team creation permissions
const mockUser: AuthUser = {
  id: 'dev-mock-admin-user',
  email: 'test@example.com',
  role: UserRole.ADMIN,
  permissions: ROLE_PERMISSIONS[UserRole.ADMIN],
  profile: {
    id: 'profile-123',
    user_id: 'dev-user-123',
    first_name: 'Test',
    last_name: 'User',
    display_name: 'Test User',
    bio: '',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString()
}

// Cookie names for authentication
const AUTH_COOKIE_NAME = 'sb-auth-token'
const REFRESH_COOKIE_NAME = 'sb-refresh-token'
const SESSION_ID_COOKIE_NAME = 'sb-session-id'

/**
 * Development mode check
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && 
         (!process.env.NEXT_PUBLIC_SUPABASE_URL || 
          process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co')
}

/**
 * Mock getCurrentUser function for development
 */
export async function getCurrentUserDev(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const sessionId = request.cookies.get(SESSION_ID_COOKIE_NAME)?.value
  
  // In dev mode, accept any token or create mock session
  if (!token || !sessionId) {
    return null
  }

  return mockUser
}

/**
 * Create mock authentication cookies for development
 */
export function createMockAuthCookies(): NextResponse {
  const response = NextResponse.json({ 
    success: true,
    message: 'Development mode - Mock authentication created'
  })
  
  const mockToken = 'dev-token-' + Date.now()
  const mockRefreshToken = 'dev-refresh-' + Date.now()
  const mockSessionId = 'dev-session-' + Date.now()

  // Set mock cookies
  response.cookies.set(AUTH_COOKIE_NAME, mockToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })

  response.cookies.set(REFRESH_COOKIE_NAME, mockRefreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })

  response.cookies.set(SESSION_ID_COOKIE_NAME, mockSessionId, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  return response
}

/**
 * Mock login function for development
 */
export async function mockLogin(email: string, password: string): Promise<AuthUser> {
  // In development mode, accept any credentials
  if (email === 'test@example.com' && password === 'password123') {
    return mockUser
  }
  throw new Error('Invalid credentials')
}

/**
 * Clear auth cookies
 */
export function clearAuthCookiesDev(){
  return NextResponse.json({ success: true })
}

/**
 * Mock session response for development
 */
export async function getMockSessionResponse(): Promise<NextResponse> {
  return NextResponse.json({
    user: mockUser,
    session: {
      access_token: 'dev-token-' + Date.now(),
      refresh_token: 'dev-refresh-' + Date.now(),
      expires_at: Date.now() + 3600000
    }
  })
}
