import { NextRequest, NextResponse } from 'next/server'
import { cleanupInvalidCredentials } from '@/lib/database-storage'

function getUserId(request: NextRequest): string {
  return 'demo-user'
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const result = await cleanupInvalidCredentials(userId)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Invalid credentials cleaned up successfully'
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to cleanup credentials' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
