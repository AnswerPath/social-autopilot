import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'
import { getCurrentUser } from '@/lib/auth-utils'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Twitter profile...')

    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          profile: null,
          requiresSetup: false,
        },
        { status: 401 }
      )
    }

    const result = await getTwitterCredentials(user.id)

    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({
        success: true,
        mock: false,
        profile: null,
        requiresSetup: true,
      })
    }

    const credentials = result.credentials

    // Prefer Bearer token (usually higher limits), else OAuth 1.0a
    if (credentials.bearerToken && !credentials.bearerToken.includes('demo_')) {
      try {
        const resp = await fetch('https://api.twitter.com/2/users/me?user.fields=description,public_metrics,profile_image_url', {
          headers: { Authorization: `Bearer ${credentials.bearerToken}` }
        })
        if (resp.ok) {
          const data = await resp.json()
          console.log('✅ Real Twitter profile fetched (Bearer)')
          return NextResponse.json({
            success: true,
            mock: false,
            profile: {
              id: data.data.id,
              username: data.data.username,
              name: data.data.name,
              description: data.data.description || '',
              public_metrics: data.data.public_metrics || { followers_count: 0, following_count: 0, tweet_count: 0 },
              profile_image_url: data.data.profile_image_url || '/placeholder.svg?height=100&width=100',
            },
          })
        } else {
          const err = await resp.json().catch(() => ({}))
          const errorInfo = { status: resp.status, error: err }
          console.log('⚠️ Bearer profile fetch failed, trying OAuth 1.0a:', errorInfo)
          ;(globalThis as any).__last_profile_error = errorInfo
        }
      } catch (e: any) {
        const errorInfo = { message: e?.message || 'Unknown bearer error' }
        console.log('⚠️ Bearer profile fetch error, trying OAuth 1.0a:', errorInfo)
        ;(globalThis as any).__last_profile_error = errorInfo
      }
    }

    // Try OAuth 1.0a
    try {
      const client = new TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessSecret,
      })

      const twUser = await client.v2.me({
        'user.fields': ['description', 'public_metrics', 'profile_image_url']
      })

      console.log('✅ Real Twitter profile fetched (OAuth 1.0a)')
      return NextResponse.json({
        success: true,
        mock: false,
        profile: {
          id: twUser.data.id,
          username: twUser.data.username,
          name: twUser.data.name,
          description: twUser.data.description || '',
          public_metrics: {
            followers_count: twUser.data.public_metrics?.followers_count || 0,
            following_count: twUser.data.public_metrics?.following_count || 0,
            tweet_count: twUser.data.public_metrics?.tweet_count || 0,
          },
          profile_image_url: twUser.data.profile_image_url || '/placeholder.svg?height=100&width=100'
        }
      })
    } catch (apiError: any) {
      const errorInfo = (() => {
        try { return JSON.parse(JSON.stringify(apiError)) } catch { return { message: apiError?.message || 'Unknown error' } }
      })()
      console.log('⚠️ OAuth profile fetch failed:', errorInfo)
      ;(globalThis as any).__last_profile_error = errorInfo
    }

    console.log('❌ Twitter API unavailable; returning empty profile')
    return NextResponse.json({
      success: false,
      mock: false,
      profile: null,
      error: 'Twitter API call failed',
      note: 'Could not load profile from X. Try again or check credentials.',
      details: (globalThis as any).__last_profile_error,
    }, { status: 502 })

  } catch (error) {
    console.error('❌ Profile fetch error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch profile',
      mock: false,
      profile: null,
    }, { status: 500 })
  }
}
