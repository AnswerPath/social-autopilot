import { NextRequest, NextResponse } from 'next/server'
import { 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth-types'
import { 
  getCurrentUser,
  getUserSessions,
  deactivateOtherSessions,
  createAuthError,
  requireAuth
} from '@/lib/auth-utils'

// Get user sessions
export async function GET(request: NextRequest) {
  return requireAuth(async (req: NextRequest, user: any) => {
    try {
      const sessions = await getUserSessions(user.id)
      
      return NextResponse.json({
        sessions: sessions.map(session => ({
          id: session.session_id,
          created_at: session.created_at,
          last_activity: session.last_activity,
          ip_address: session.ip_address,
          user_agent: session.user_agent,
          expires_at: session.expires_at
        }))
      })
    } catch (error) {
      console.error('Get sessions error:', error)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get sessions') },
        { status: 500 }
      )
    }
  })(request)
}

// Deactivate other sessions
export async function DELETE(request: NextRequest) {
  return requireAuth(async (req: NextRequest, user: any) => {
    try {
      const sessionId = request.cookies.get('sb-session-id')?.value
      
      if (!sessionId) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'No active session') },
          { status: 401 }
        )
      }

      await deactivateOtherSessions(user.id, sessionId)
      
      return NextResponse.json({
        message: 'Other sessions deactivated successfully'
      })
    } catch (error) {
      console.error('Deactivate sessions error:', error)
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to deactivate sessions') },
        { status: 500 }
      )
    }
  })(request)
}
