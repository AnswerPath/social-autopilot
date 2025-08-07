import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching Twitter profile...')
    
    const result = await getTwitterCredentials('demo-user')
    
    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        error: 'No Twitter credentials configured',
        mock: true,
        profile: {
          id: '1234567890',
          username: 'your_username',
          name: 'Your Social Media Brand',
          description: 'Automated social media management made simple 🚀',
          followers_count: 15420,
          following_count: 892,
          tweet_count: 3456,
          profile_image_url: '/placeholder.svg?height=100&width=100'
        }
      })
    }

    const credentials = result.credentials
    
    // Try to use real Twitter API
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

        console.log('✅ Real Twitter profile fetched')
        return NextResponse.json({
          mock: false,
          profile: {
            id: user.data.id,
            username: user.data.username,
            name: user.data.name,
            description: user.data.description || '',
            followers_count: user.data.public_metrics?.followers_count || 0,
            following_count: user.data.public_metrics?.following_count || 0,
            tweet_count: user.data.public_metrics?.tweet_count || 0,
            profile_image_url: user.data.profile_image_url || '/placeholder.svg?height=100&width=100'
          }
        })
    } catch (apiError) {
      console.log('⚠️ Twitter API error, falling back to enhanced mock:', apiError)
    }

    // Enhanced mock data for development or API fallback
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      mock: true,
      enhanced: true,
      profile: {
        id: '1234567890',
        username: 'social_autopilot',
        name: 'Social Autopilot Pro',
        description: 'AI-powered social media automation • Scheduling • Analytics • Growth 🚀',
        followers_count: 28750,
        following_count: 1240,
        tweet_count: 5680,
        profile_image_url: '/placeholder.svg?height=100&width=100'
      }
    })

  } catch (error) {
    console.error('❌ Profile fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch profile',
      mock: true,
      profile: {
        id: '1234567890',
        username: 'demo_user',
        name: 'Demo User',
        description: 'Demo account for Social Autopilot',
        followers_count: 1000,
        following_count: 500,
        tweet_count: 100,
        profile_image_url: '/placeholder.svg?height=100&width=100'
      }
    }, { status: 500 })
  }
}
