import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching mentions...')
    
    const result = await getTwitterCredentials('demo-user')
    
    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        error: 'No Twitter credentials configured',
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

        const mentions = await client.v2.userMentionTimeline('me', {
          max_results: 10,
          'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
          'user.fields': ['username', 'name']
        })

        console.log('✅ Real mentions fetched')
        return NextResponse.json({
          mock: false,
          mentions: mentions.data.data?.map(mention => ({
            id: mention.id,
            text: mention.text,
            created_at: mention.created_at,
            author: {
              username: mention.author_id || 'unknown',
              name: 'Twitter User'
            },
            retweet_count: mention.public_metrics?.retweet_count || 0,
            like_count: mention.public_metrics?.like_count || 0,
            reply_count: mention.public_metrics?.reply_count || 0
          })) || []
        })
    } catch (apiError) {
      console.log('⚠️ Twitter API error, falling back to enhanced mock:', apiError)
    }

    // Enhanced mock data
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      mock: true,
      enhanced: true,
      mentions: generateMockMentions(true)
    })

  } catch (error) {
    console.error('❌ Mentions fetch error:', error)
    return NextResponse.json({ 
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
      author: {
        username: enhanced ? 'marketing_pro_sarah' : 'user1',
        name: enhanced ? 'Sarah | Marketing Pro' : 'User One'
      },
      retweet_count: enhanced ? 12 : 2,
      like_count: enhanced ? 89 : 5,
      reply_count: enhanced ? 15 : 1
    },
    {
      id: '2',
      text: enhanced
        ? '@social_autopilot The analytics dashboard is pure gold! Finally understand which posts perform best. ROI tracking is exactly what I needed for client reports. 📊✨'
        : '@your_username Thanks for the help!',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      author: {
        username: enhanced ? 'agency_owner_mike' : 'user2',
        name: enhanced ? 'Mike | Agency Owner' : 'User Two'
      },
      retweet_count: enhanced ? 8 : 1,
      like_count: enhanced ? 67 : 3,
      reply_count: enhanced ? 9 : 0
    },
    {
      id: '3',
      text: enhanced
        ? '@social_autopilot Question: Can I connect multiple Twitter accounts? Managing 5 client accounts and this would be a game changer for my workflow! 🚀'
        : '@your_username Looking forward to updates!',
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      author: {
        username: enhanced ? 'freelancer_jenny' : 'user3',
        name: enhanced ? 'Jenny | Freelancer' : 'User Three'
      },
      retweet_count: enhanced ? 3 : 0,
      like_count: enhanced ? 34 : 2,
      reply_count: enhanced ? 12 : 1
    }
  ]

  return baseMentions
}
