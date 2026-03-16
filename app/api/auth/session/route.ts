import { NextRequest, NextResponse } from 'next/server'
import { 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth-types'
import { 
  getCurrentUser,
  createAuthError
} from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'No active session') },
        { status: 401 }
      )
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
