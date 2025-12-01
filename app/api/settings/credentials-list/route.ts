import { NextRequest, NextResponse } from 'next/server'
import { listUserCredentials } from '@/lib/database-storage'
import { getXApiCredentials } from '@/lib/x-api-storage'

function getUserId(request: NextRequest): string {
  return 'demo-user'
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    
    // Get all credentials (for migration purposes)
    const result = await listUserCredentials(userId)
    
    if (result.success) {
      // Filter to only show X API credentials, or migrate Twitter to X API
      const credentials = result.credentials || []
      
      // Check if user has X API credentials
      const xApiResult = await getXApiCredentials(userId)
      const hasXApi = xApiResult.success && !!xApiResult.credentials
      
      // Filter out Twitter credentials if X API credentials exist
      // If no X API credentials, show Twitter credentials (they'll be migrated on next use)
      const filteredCredentials = hasXApi
        ? credentials.filter(c => c.credential_type === 'x-api')
        : credentials.map(c => {
            // If it's a Twitter credential, mark it for migration
            if (c.credential_type === 'twitter') {
              return {
                ...c,
                credential_type: 'x-api', // Show as X API (will be migrated)
                migration_note: 'Will be migrated to X API format on next use'
              }
            }
            return c
          })
      
      return NextResponse.json({
        success: true,
        credentials: filteredCredentials
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
