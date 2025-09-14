import { NextRequest, NextResponse } from 'next/server'
import { 
  getCurrentUser,
  logAuditEvent,
  createAuthError,
  clearAuthCookies
} from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'

export async function POST(request: NextRequest) {
  try {
    // Get current user for audit logging
    const user = await getCurrentUser(request)
    
    // Clear authentication cookies
    await clearAuthCookies()

    // Log logout event if user was authenticated
    if (user) {
      await logAuditEvent(
        user.id,
        'logout_success',
        'auth',
        undefined,
        { email: user.email },
        request
      )
    }

    return NextResponse.json({
      message: 'Logged out successfully'
    })

  } catch (error) {
    console.error('Logout error:', error)
    
    // Still clear cookies even if there's an error
    await clearAuthCookies()
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
