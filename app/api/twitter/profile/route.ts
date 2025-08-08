import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Twitter profile...')
    
    const result = await getTwitterCredentials('demo-user')
    
    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        success: true,
        mock: true,
        profile: {
          id: '1234567890',
          username: 'your_username',
          name: 'Your Social Media Brand',
          description: 'Automated social media management made simple 🚀',
          public_metrics: {
            followers_count: 15420,
            following_count: 892,
            tweet_count: 3456,
          },
          profile_image_url: '/placeholder.svg?height=100&width=100'
        }
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

      const user = await client.v2.me({
        'user.fields': ['description', 'public_metrics', 'profile_image_url']
      })

      console.log('✅ Real Twitter profile fetched (OAuth 1.0a)')
      return NextResponse.json({
        success: true,
        mock: false,
        profile: {
          id: user.data.id,
          username: user.data.username,
          name: user.data.name,
          description: user.data.description || '',
          public_metrics: {
            followers_count: user.data.public_metrics?.followers_count || 0,
            following_count: user.data.public_metrics?.following_count || 0,
            tweet_count: user.data.public_metrics?.tweet_count || 0,
          },
          profile_image_url: user.data.profile_image_url || '/placeholder.svg?height=100&width=100'
        }
      })
    } catch (apiError: any) {
      const errorInfo = (() => {
        try { return JSON.parse(JSON.stringify(apiError)) } catch { return { message: apiError?.message || 'Unknown error' } }
      })()
      console.log('⚠️ OAuth profile fetch failed:', errorInfo)
      ;(globalThis as any).__last_profile_error = errorInfo
    }

    // Enhanced mock data for development or API fallback
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      success: true,
      mock: true,
      enhanced: true,
      profile: {
        id: '1234567890',
        username: 'social_autopilot',
        name: 'Social Autopilot Pro',
        description: 'AI-powered social media automation • Scheduling • Analytics • Growth 🚀',
        public_metrics: {
          followers_count: 28750,
          following_count: 1240,
          tweet_count: 5680,
        },
        profile_image_url: '/placeholder.svg?height=100&width=100'
      },
      note: 'Twitter API call failed; returning enhanced mock data',
      error: (globalThis as any).__last_profile_error
    })

  } catch (error) {
    console.error('❌ Profile fetch error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch profile',
      mock: true,
      profile: {
        id: '1234567890',
        username: 'demo_user',
        name: 'Demo User',
        description: 'Demo account for Social Autopilot',
        public_metrics: {
          followers_count: 1000,
          following_count: 500,
          tweet_count: 100,
        },
        profile_image_url: '/placeholder.svg?height=100&width=100'
      }
    }, { status: 500 })
  }
}
