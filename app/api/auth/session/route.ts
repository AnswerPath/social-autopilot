import { NextRequest, NextResponse } from 'next/server'
import { 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth-types'
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils'

const AUTH_COOKIE_NAMES = ['sb-auth-token', 'sb-refresh-token', 'sb-session-id'] as const

function clearAuthCookiesOnResponse(response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production'
  for (const name of AUTH_COOKIE_NAMES) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
  }
  return response
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      const response = NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'No active session') },
        { status: 401 }
      )
      return clearAuthCookiesOnResponse(response)
    }

    // Return user data (without sensitive information)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        profile: user.profile
      }
    })

  } catch (error) {
    console.error('Get session error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
