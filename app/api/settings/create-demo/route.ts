import { NextRequest, NextResponse } from 'next/server'
import { createDemoCredentials } from '@/lib/database-storage'

export async function POST(request: NextRequest) {
  try {
    const result = await createDemoCredentials()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Demo credentials created successfully'
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to create demo credentials' },
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
