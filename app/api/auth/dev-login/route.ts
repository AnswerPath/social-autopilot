import { NextRequest, NextResponse } from 'next/server'
import { createMockAuthCookies } from '@/lib/auth-dev'

/**
 * POST /api/auth/dev-login
 * Development-only endpoint to create mock authentication cookies
 */
export async function POST(request: NextRequest) {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  try {
    // Create mock authentication cookies
    const response = createMockAuthCookies()
    
    return response
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json(
      { error: 'Failed to create development authentication' },
      { status: 500 }
    )
  }
}
