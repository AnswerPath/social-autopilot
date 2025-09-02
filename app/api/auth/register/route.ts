import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  RegisterRequest, 
  AuthError, 
  AuthErrorType, 
  UserRole 
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
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(user => user.email === email)
    if (existingUser) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'User with this email already exists') },
        { status: 409 }
      )
    }

    // Create new user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
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
    const profile = await createUserProfile(data.user.id, {
      first_name,
      last_name,
      display_name: display_name || `${first_name} ${last_name}`.trim()
    })

    // Assign default role (VIEWER)
    await assignUserRole(data.user.id, UserRole.VIEWER)

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
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

    // Set authentication cookies
    await setAuthCookies(signInData.session)

    // Log successful registration
    await logAuditEvent(
      data.user.id,
      'registration_success',
      'auth',
      undefined,
      { email, role: UserRole.VIEWER },
      request
    )

    // Return user data
    return NextResponse.json({
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

  } catch (error) {
    console.error('Registration error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
