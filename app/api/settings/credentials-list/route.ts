import { NextRequest, NextResponse } from 'next/server'
import { listUserCredentials } from '@/lib/database-storage'
import { getXApiCredentialsMetadata } from '@/lib/x-api-storage'
import { requireSessionUserId } from '@/lib/require-session-user'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    
    // Get all credentials (for migration purposes)
    const result = await listUserCredentials(userId)
    
    if (result.success) {
      // Filter to only show X API credentials, or migrate Twitter to X API
      const credentials = result.credentials || []
      
      const xMeta = await getXApiCredentialsMetadata(userId)
      const hasXApi = xMeta.success && !!xMeta.metadata?.hasRow
      const m = xMeta.metadata
      const has_xapi_row = !!(m?.hasRow)
      const is_xapi_valid = !!(m?.hasRow && m.isValid)
      const pending_oauth = !!(m?.hasRow && m.hasConsumerKeys && !m.hasAccessTokens)
      
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
        credentials: filteredCredentials,
        has_xapi_row,
        is_xapi_valid,
        pending_oauth,
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
