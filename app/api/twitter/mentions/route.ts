import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching mentions...')
    
    const result = await getTwitterCredentials('demo-user')
    
    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        success: true,
        mock: true,
        mentions: generateMockMentions(false)
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

        const me = await client.v2.me()
        const mentions = await client.v2.userMentionTimeline(me.data.id, {
          max_results: 10,
          'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
          'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
          expansions: ['author_id']
        })

        console.log('✅ Real mentions fetched')
        const users = mentions.includes?.users || []
        return NextResponse.json({
          success: true,
          mock: false,
          mentions: mentions.data.data?.map(mention => {
            const author = users.find((u: any) => u.id === mention.author_id)
            return {
              id: mention.id,
              text: mention.text,
              created_at: mention.created_at,
              username: author?.username || 'unknown',
              name: author?.name || 'Twitter User',
              profile_image_url: author?.profile_image_url || '/placeholder.svg?height=40&width=40',
              public_metrics: {
                followers_count: author?.public_metrics?.followers_count || 0,
                following_count: author?.public_metrics?.following_count || 0,
              }
            }
          }) || []
        })
    } catch (apiError: any) {
      const errorInfo = (() => { try { return JSON.parse(JSON.stringify(apiError)) } catch { return { message: apiError?.message || 'Unknown error' } } })()
      console.log('⚠️ Twitter API error, falling back to enhanced mock:', errorInfo)
      ;(globalThis as any).__last_mentions_error = errorInfo
    }

    // Enhanced mock data
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      success: true,
      mock: true,
      enhanced: true,
      mentions: generateMockMentions(true),
      note: 'Twitter API call failed; returning enhanced mock data',
      error: (globalThis as any).__last_mentions_error
    })

  } catch (error) {
    console.error('❌ Mentions fetch error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch mentions',
      mock: true,
      mentions: generateMockMentions(false)
    }, { status: 500 })
  }
}

function generateMockMentions(enhanced: boolean) {
  const baseMentions = [
    {
      id: '1',
      text: enhanced
        ? '@social_autopilot This tool is incredible! Just scheduled 2 weeks of content in 30 minutes. The AI suggestions are spot on. How did I manage social media without this? 🤯'
        : '@your_username Great tool!',
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      username: enhanced ? 'marketing_pro_sarah' : 'user1',
      name: enhanced ? 'Sarah | Marketing Pro' : 'User One',
      profile_image_url: '/placeholder.svg?height=40&width=40',
      public_metrics: {
        followers_count: enhanced ? 5600 : 200,
        following_count: enhanced ? 1200 : 100,
      }
    },
    {
      id: '2',
      text: enhanced
        ? '@social_autopilot The analytics dashboard is pure gold! Finally understand which posts perform best. ROI tracking is exactly what I needed for client reports. 📊✨'
        : '@your_username Thanks for the help!',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      username: enhanced ? 'agency_owner_mike' : 'user2',
      name: enhanced ? 'Mike | Agency Owner' : 'User Two',
      profile_image_url: '/placeholder.svg?height=40&width=40',
      public_metrics: {
        followers_count: enhanced ? 3400 : 150,
        following_count: enhanced ? 980 : 75,
      }
    },
    {
      id: '3',
      text: enhanced
        ? '@social_autopilot Question: Can I connect multiple Twitter accounts? Managing 5 client accounts and this would be a game changer for my workflow! 🚀'
        : '@your_username Looking forward to updates!',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      username: enhanced ? 'freelancer_jenny' : 'user3',
      name: enhanced ? 'Jenny | Freelancer' : 'User Three',
      profile_image_url: '/placeholder.svg?height=40&width=40',
      public_metrics: {
        followers_count: enhanced ? 2100 : 80,
        following_count: enhanced ? 540 : 60,
      }
    }
  ]

  return baseMentions
}
