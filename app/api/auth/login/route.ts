import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { 
  LoginRequest, 
  AuthError, 
  AuthErrorType, 
  UserRole,
  ROLE_PERMISSIONS 
} from '@/lib/auth-types'
import { 
  setAuthCookiesResponse, 
  createUserProfile, 
  assignUserRole, 
  logAuditEvent,
  createAuthError,
  createUserSession,
  isDevMode
} from '@/lib/auth-utils'
import { createMockAuthCookies, mockLogin } from '@/lib/auth-dev'
import { withRateLimit, clearRateLimit } from '@/lib/rate-limiting'

export async function POST(request: NextRequest) {
  return withRateLimit('loginAttempts')(request, async (req) => {
    try {
      const body: LoginRequest = await req.json()
      const { email, password } = body

      // Validate input
      if (!email || !password) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Email and password are required') },
          { status: 400 }
        )
      }

      // Handle development mode
      if (isDevMode()) {
        try {
          const mockUser = await mockLogin(email, password)
          
          const response = NextResponse.json({
            user: mockUser,
            session: {
              expires_at: Date.now() + 3600000
            }
          })

          const mockToken = 'dev-token-' + Date.now()
          const mockRefreshToken = 'dev-refresh-' + Date.now()
          const mockSessionId = 'dev-session-' + Date.now()

          response.cookies.set('sb-auth-token', mockToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 // 24 hours
          })

          response.cookies.set('sb-refresh-token', mockRefreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
          })

          response.cookies.set('sb-session-id', mockSessionId, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/'
          })

          return response
        } catch (error) {
          return NextResponse.json(
            { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid credentials') },
            { status: 401 }
          )
        }
      }

      // Attempt to sign in with Supabase
      const { data, error } = await getSupabaseAdmin().auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // Log failed login attempt
        await logAuditEvent(
          'anonymous',
          'login_failed',
          'auth',
          undefined,
          { email, error: error.message },
          req
        )

        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Invalid email or password') },
          { status: 401 }
        )
      }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication failed') },
        { status: 401 }
      )
    }

    // Create session record
    const sessionId = await createUserSession(data.user.id, data.session, request)

    // Get user role from database (default to VIEWER if not set)
    const { data: roleData } = await getSupabaseAdmin()
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    const role = (roleData?.role as UserRole) || UserRole.VIEWER
    const permissions = ROLE_PERMISSIONS[role]

    // Get user profile
    const { data: profile } = await getSupabaseAdmin()
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    // Clear rate limit on successful login
    clearRateLimit(req, 'loginAttempts')

    // Log successful login
    await logAuditEvent(
      data.user.id,
      'login_success',
      'auth',
      undefined,
      { email, role },
      req
    )

    // Create response with cookies set
    const response = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        permissions,
        profile: profile || undefined
      },
      session: {
        expires_at: data.session.expires_at
      }
    })

    // Set cookies
    response.cookies.set('sb-auth-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    })

    response.cookies.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    response.cookies.set('sb-session-id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
    }
  });
}
