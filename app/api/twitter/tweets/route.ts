import { NextRequest, NextResponse } from 'next/server'
import { getStoredCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching recent tweets...')
    
    const credentials = await getStoredCredentials()
    
    if (!credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        error: 'No Twitter credentials configured',
        mock: true,
        tweets: generateMockTweets(false)
      })
    }

    // Try to use real Twitter API in production
    if (process.env.NODE_ENV === 'production') {
      try {
        const client = new TwitterApi({
          appKey: credentials.apiKey,
          appSecret: credentials.apiSecret,
          accessToken: credentials.accessToken,
          accessSecret: credentials.accessSecret,
        })

        const tweets = await client.v2.userTimeline('me', {
          max_results: 10,
          'tweet.fields': ['created_at', 'public_metrics', 'context_annotations']
        })

        console.log('✅ Real tweets fetched')
        return NextResponse.json({
          mock: false,
          tweets: tweets.data.data?.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            retweet_count: tweet.public_metrics?.retweet_count || 0,
            like_count: tweet.public_metrics?.like_count || 0,
            reply_count: tweet.public_metrics?.reply_count || 0
          })) || []
        })
      } catch (apiError) {
        console.log('⚠️ Twitter API error, falling back to enhanced mock:', apiError)
      }
    }

    // Enhanced mock data
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      mock: true,
      enhanced: true,
      tweets: generateMockTweets(true)
    })

  } catch (error) {
    console.error('❌ Tweets fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch tweets',
      mock: true,
      tweets: generateMockTweets(false)
    }, { status: 500 })
  }
}

function generateMockTweets(enhanced: boolean) {
  const baseTweets = [
    {
      id: '1',
      text: enhanced 
        ? '🚀 Just automated 50 social media posts for the week! Social Autopilot is saving me 10+ hours. The AI-powered scheduling is incredible. #SocialMediaAutomation #ProductivityHack'
        : 'Just posted a new update about our product!',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      retweet_count: enhanced ? 24 : 5,
      like_count: enhanced ? 156 : 12,
      reply_count: enhanced ? 18 : 3
    },
    {
      id: '2',
      text: enhanced
        ? '📊 Analytics update: Our automated posts are getting 3x more engagement than manual posts. The AI really understands optimal timing and content structure. Game changer! 📈'
        : 'Check out our latest analytics dashboard!',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      retweet_count: enhanced ? 31 : 8,
      like_count: enhanced ? 203 : 15,
      reply_count: enhanced ? 27 : 4
    },
    {
      id: '3',
      text: enhanced
        ? '💡 Pro tip: Use Social Autopilot\'s bulk upload feature to schedule a month of content in 15 minutes. Just uploaded 120 posts with custom hashtags and optimal timing! ⚡'
        : 'Working on some exciting new features!',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      retweet_count: enhanced ? 45 : 3,
      like_count: enhanced ? 287 : 8,
      reply_count: enhanced ? 34 : 2
    }
  ]

  return baseTweets
}
