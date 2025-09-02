import { NextRequest, NextResponse } from 'next/server'
import { 
  AuthError, 
  AuthErrorType 
} from '@/lib/auth-types'
import { 
  refreshAccessToken,
  createAuthError
} from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const refreshResult = await refreshAccessToken(request)
    
    if (!refreshResult.success) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.TOKEN_INVALID, 'Token refresh failed') },
        { status: 401 }
      )
    }

    return NextResponse.json({
      message: 'Token refreshed successfully',
      newToken: refreshResult.newToken
    })

  } catch (error) {
    console.error('Token refresh error:', error)
    
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Internal server error') },
      { status: 500 }
    )
  }
}
