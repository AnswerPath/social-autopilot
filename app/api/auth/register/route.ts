import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { 
  RegisterRequest, 
  AuthError, 
  AuthErrorType, 
  UserRole 
} from '@/lib/auth-types'
import { 
  setAuthCookiesResponse, 
  createUserProfile, 
  logAuditEvent,
  createAuthError,
  createUserSession
} from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json()
    const { email, password, first_name, last_name, display_name } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Email and password are required') },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Password must be at least 8 characters long') },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUsers } = await getSupabaseAdmin().auth.admin.listUsers()
    const existingUser = existingUsers.users.find(user => user.email === email)
    if (existingUser) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'User with this email already exists') },
        { status: 409 }
      )
    }

    // Create new user with Supabase Auth
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email for now (can be changed later)
    })

    if (error) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, `Failed to create user: ${error.message}`) },
        { status: 500 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create user') },
        { status: 500 }
      )
    }

    // Create user profile
    let profile
    try {
      profile = await createUserProfile(data.user.id, {
        first_name,
        last_name,
        display_name: display_name || `${first_name} ${last_name}`.trim()
      })
      console.log('✅ Profile created successfully')
    } catch (profileError) {
      console.error('❌ Profile creation failed:', profileError)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, `Failed to create profile: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`) },
        { status: 500 }
      )
    }

    // Role is automatically assigned by trigger when profile is created
    console.log('✅ Role automatically assigned by trigger')

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await getSupabaseAdmin().auth.signInWithPassword({
      email,
      password
    })

    if (signInError || !signInData.session) {
      // User created but couldn't sign in - they'll need to login manually
      return NextResponse.json({
        message: 'User created successfully. Please log in.',
        user: {
          id: data.user.id,
          email: data.user.email,
          role: UserRole.VIEWER,
          profile
        }
      })
    }

    // Create session in database
    const sessionId = await createUserSession(data.user.id, signInData.session, request)

    // Log successful registration
    await logAuditEvent(
      data.user.id,
      'registration_success',
      'auth',
      undefined,
      { email, role: UserRole.VIEWER },
      request
    )

    // Create response with cookies set
    const response = NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: UserRole.VIEWER,
        profile
      },
      session: {
        expires_at: signInData.session.expires_at
      }
    })
    
    // Set cookies
    response.cookies.set('sb-auth-token', signInData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 // 1 hour
    })
    
    response.cookies.set('sb-refresh-token', signInData.session.refresh_token, {
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
    console.error('Registration error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
