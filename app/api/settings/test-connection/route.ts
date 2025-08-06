import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials, updateCredentialValidation } from '@/lib/database-storage'
import { testTwitterConnection } from '@/lib/twitter-validation'

function getUserId(request: NextRequest): string {
  // In a real app, extract from JWT token or session
  return 'demo-user'
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    
    const result = await getTwitterCredentials(userId)
    
    if (!result.success || !result.credentials) {
      return NextResponse.json(
        { error: 'No credentials found. Please add your Twitter API keys first.' },
        { status: 400 }
      )
    }
    
    const testResult = await testTwitterConnection(result.credentials)
    
    // Update validation status in database
    await updateCredentialValidation(userId, testResult.success)
    
    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: testResult.message,
        details: testResult.details
      })
    } else {
      return NextResponse.json(
        { error: testResult.message },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}
