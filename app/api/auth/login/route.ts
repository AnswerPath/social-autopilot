import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  LoginRequest, 
  AuthError, 
  AuthErrorType, 
  UserRole,
  ROLE_PERMISSIONS 
} from '@/lib/auth-types'
import { 
  setAuthCookies, 
  createUserProfile, 
  assignUserRole, 
  logAuditEvent,
  createAuthError 
} from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Email and password are required') },
        { status: 400 }
      )
    }

    // Attempt to sign in with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
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
        request
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
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .single()

    const role = roleData?.role || UserRole.VIEWER
    const permissions = ROLE_PERMISSIONS[role]

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    // Set authentication cookies
    await setAuthCookies(data.session, sessionId)

    // Log successful login
    await logAuditEvent(
      data.user.id,
      'login_success',
      'auth',
      undefined,
      { email, role },
      request
    )

    // Return user data (without sensitive information)
    return NextResponse.json({
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

  } catch (error) {
    console.error('Login error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
