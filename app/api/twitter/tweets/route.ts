import { NextRequest, NextResponse } from 'next/server'
import { getTwitterCredentials } from '@/lib/database-storage'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching recent tweets...')
    
    const result = await getTwitterCredentials('demo-user')
    
    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({ 
        success: true,
        mock: true,
        tweets: generateMockTweets(false)
      })
    }

    const credentials = result.credentials
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const CACHE_TTL_MS = 15 * 60 * 1000
    const cacheKey = `tweets:${start || 'none'}:${end || 'none'}`
    const cache = (globalThis as any).__tweets_cache as { [k: string]: { ts: number; data: any[] } } | undefined

    // Prefer Bearer token
    if (credentials.bearerToken && !credentials.bearerToken.includes('demo_')) {
      try {
        const meResp = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics', {
          headers: { Authorization: `Bearer ${credentials.bearerToken}` },
        })
        if (meResp.ok) {
          const meData = await meResp.json()
          const params = new URLSearchParams({ 'tweet.fields': 'created_at,public_metrics' })
          if (start) params.set('start_time', start)
          if (end) params.set('end_time', end)
          params.set('max_results', '100')
          const tlResp = await fetch(`https://api.twitter.com/2/users/${meData.data.id}/tweets?${params.toString()}`, {
            headers: { Authorization: `Bearer ${credentials.bearerToken}` },
          })
          if (tlResp.ok) {
            const tl = await tlResp.json()
            const items = (tl.data || []).map((tweet: any) => ({
              id: tweet.id,
              text: tweet.text,
              created_at: tweet.created_at,
              public_metrics: tweet.public_metrics || { retweet_count: 0, like_count: 0, reply_count: 0, impression_count: 0 },
            }))
            ;(globalThis as any).__tweets_cache = { ...(cache || {}), [cacheKey]: { ts: Date.now(), data: items } }
            console.log('✅ Real tweets fetched (Bearer)')
            return NextResponse.json({ success: true, mock: false, tweets: items })
          } else {
            const err = await tlResp.json().catch(() => ({}))
            const errorInfo = { status: tlResp.status, error: err }
            console.log('⚠️ Bearer tweets fetch failed, trying OAuth 1.0a:', errorInfo)
            ;(globalThis as any).__last_tweets_error = errorInfo
          }
        } else {
          const err = await meResp.json().catch(() => ({}))
          const errorInfo = { status: meResp.status, error: err }
          console.log('⚠️ Bearer me fetch failed, trying OAuth 1.0a:', errorInfo)
          ;(globalThis as any).__last_tweets_error = errorInfo
        }
      } catch (e: any) {
        const errorInfo = { message: e?.message || 'Unknown bearer error' }
        console.log('⚠️ Bearer tweets error, trying OAuth 1.0a:', errorInfo)
        ;(globalThis as any).__last_tweets_error = errorInfo
      }
    }

    // Fallback to OAuth 1.0a via twitter-api-v2
    try {
      const client = new TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessSecret,
      })

      const me = await client.v2.me()
      const maxResults = 50
      const tweets = await client.v2.userTimeline(me.data.id, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations'],
      })

      console.log('✅ Real tweets fetched (OAuth 1.0a)')
      const items = tweets.data.data?.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        public_metrics: {
          retweet_count: tweet.public_metrics?.retweet_count || 0,
          like_count: tweet.public_metrics?.like_count || 0,
          reply_count: tweet.public_metrics?.reply_count || 0,
          impression_count: tweet.public_metrics?.impression_count || 0,
        },
      })) || []

      // Filter by client-provided window
      const filtered = items.filter(t => {
        if (!t.created_at) return false
        const ts = Date.parse(t.created_at)
        if (start && ts < Date.parse(start)) return false
        if (end && ts > Date.parse(end)) return false
        return true
      })
      ;(globalThis as any).__tweets_cache = { ...(cache || {}), [cacheKey]: { ts: Date.now(), data: filtered } }
      return NextResponse.json({ success: true, mock: false, tweets: filtered })
    } catch (apiError: any) {
      const errorInfo = (() => { try { return JSON.parse(JSON.stringify(apiError)) } catch { return { message: apiError?.message || 'Unknown error' } } })()
      console.log('⚠️ Twitter API error, falling back to enhanced mock:', errorInfo)
      ;(globalThis as any).__last_tweets_error = errorInfo
    }

    // Try cached tweets (rate limit/backoff)
    const fresh = cache && cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL_MS
    if (fresh) {
      console.log('♻️ Serving cached tweets due to API failure/rate limit')
      return NextResponse.json({ success: true, mock: false, cached: true, tweets: cache![cacheKey].data, note: 'Served cached tweets due to rate limit or error' })
    }

    // Enhanced mock data
    console.log('📊 Using enhanced mock data with real credentials')
    return NextResponse.json({
      success: true,
      mock: true,
      enhanced: true,
      tweets: generateMockTweets(true),
      note: 'Twitter API call failed; returning enhanced mock data',
      error: (globalThis as any).__last_tweets_error,
    })

  } catch (error) {
    console.error('❌ Tweets fetch error:', error)
    return NextResponse.json({ 
      success: false,
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
      public_metrics: {
        retweet_count: enhanced ? 24 : 5,
        like_count: enhanced ? 156 : 12,
        reply_count: enhanced ? 18 : 3,
        impression_count: enhanced ? 1200 : 200,
      }
    },
    {
      id: '2',
      text: enhanced
        ? '📊 Analytics update: Our automated posts are getting 3x more engagement than manual posts. The AI really understands optimal timing and content structure. Game changer! 📈'
        : 'Check out our latest analytics dashboard!',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      public_metrics: {
        retweet_count: enhanced ? 31 : 8,
        like_count: enhanced ? 203 : 15,
        reply_count: enhanced ? 27 : 4,
        impression_count: enhanced ? 1800 : 300,
      }
    },
    {
      id: '3',
      text: enhanced
        ? '💡 Pro tip: Use Social Autopilot\'s bulk upload feature to schedule a month of content in 15 minutes. Just uploaded 120 posts with custom hashtags and optimal timing! ⚡'
        : 'Working on some exciting new features!',
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      public_metrics: {
        retweet_count: enhanced ? 45 : 3,
        like_count: enhanced ? 287 : 8,
        reply_count: enhanced ? 34 : 2,
        impression_count: enhanced ? 2400 : 350,
      }
    }
  ]

  return baseTweets
}
