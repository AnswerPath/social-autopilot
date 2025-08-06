import { NextRequest, NextResponse } from 'next/server'
import { listUserCredentials } from '@/lib/database-storage'

function getUserId(request: NextRequest): string {
  return 'demo-user'
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    
    const result = await listUserCredentials(userId)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        credentials: result.credentials
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to list credentials' },
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
