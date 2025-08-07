import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials, updateCredentialValidation } from '@/lib/database-storage'
import { testTwitterConnection } from '@/lib/twitter-validation'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

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
    
    // Try full OAuth 1.0a verification first (Node runtime only)
    let testResult: any
    try {
      const c = result.credentials
      const client = new TwitterApi({
        appKey: c.apiKey,
        appSecret: c.apiSecret,
        accessToken: c.accessToken,
        accessSecret: c.accessSecret,
      })
      const me = await client.v2.me({ 'user.fields': ['verified', 'public_metrics'] })
      testResult = {
        success: true,
        message: `Successfully connected to @${me.data.username}`,
        details: {
          user: {
            id: me.data.id,
            username: me.data.username,
            name: me.data.name,
            verified: (me.data as any).verified || false,
            followers_count: (me.data as any).public_metrics?.followers_count || 0,
          },
          permissions: { canRead: true, canWrite: true, canUploadMedia: true },
        },
      }
    } catch (_e) {
      // Fallback to existing bearer/format validation
      testResult = await testTwitterConnection(result.credentials)
    }
    
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
