import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedCredentials } from '@/lib/unified-credentials'
import { TwitterApi } from 'twitter-api-v2'
import { getCurrentUser } from '@/lib/auth-utils'

export const runtime = 'nodejs'

type TweetPublicMetrics = {
  retweet_count: number
  like_count: number
  reply_count: number
  impression_count: number
}

type CachedTweet = {
  id: string
  text: string
  created_at?: string
  public_metrics: TweetPublicMetrics
}

type CachedTweetsEntry = { ts: number; data: CachedTweet[] }

const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_TWEETS_CACHE_ENTRIES = 500

const tweetsResponseCache = new Map<string, CachedTweetsEntry>()

function pruneTweetsResponseCache(now: number): void {
  for (const [key, entry] of tweetsResponseCache) {
    if (now - entry.ts >= CACHE_TTL_MS) {
      tweetsResponseCache.delete(key)
    }
  }
}

function setTweetsCacheEntry(key: string, data: CachedTweet[], now: number): void {
  pruneTweetsResponseCache(now)
  if (tweetsResponseCache.has(key)) {
    tweetsResponseCache.delete(key)
  }
  tweetsResponseCache.set(key, { ts: now, data })
  while (tweetsResponseCache.size > MAX_TWEETS_CACHE_ENTRIES) {
    const oldestKey = tweetsResponseCache.keys().next().value
    if (oldestKey === undefined) break
    tweetsResponseCache.delete(oldestKey)
  }
}

function getFreshTweetsCacheEntry(key: string, now: number): CachedTweetsEntry | undefined {
  pruneTweetsResponseCache(now)
  const entry = tweetsResponseCache.get(key)
  if (!entry) return undefined
  if (now - entry.ts >= CACHE_TTL_MS) {
    tweetsResponseCache.delete(key)
    return undefined
  }
  // Refresh recency for LRU-style eviction.
  tweetsResponseCache.delete(key)
  tweetsResponseCache.set(key, entry)
  return entry
}

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const maxResultsRaw = searchParams.get('maxResults')
  const parsedMax = maxResultsRaw ? parseInt(maxResultsRaw, 10) : NaN
  const maxResults = Number.isFinite(parsedMax)
    ? Math.min(100, Math.max(1, parsedMax))
    : 100

  try {
    console.log('🔍 Fetching recent tweets...')

    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', mock: false, tweets: [] },
        { status: 401 }
      )
    }

    const result = await getUnifiedCredentials(user.id)

    if (!result.success || !result.credentials) {
      console.log('❌ No credentials found')
      return NextResponse.json({
        success: false,
        mock: false,
        tweets: [] as unknown[],
        requiresSetup: true,
        error: 'X API credentials not configured',
      })
    }

    const credentials = result.credentials
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const bearer = credentials.bearerToken?.trim()

    const cacheKey = `${user.id}:tweets:${start || 'none'}:${end || 'none'}:${maxResults}`

    // Prefer Bearer token
    if (bearer && !bearer.includes('demo_')) {
      try {
        const meResp = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics', {
          headers: { Authorization: `Bearer ${bearer}` },
        })
        if (meResp.ok) {
          const meData = await meResp.json()
          const params = new URLSearchParams({ 'tweet.fields': 'created_at,public_metrics' })
          if (start) params.set('start_time', start)
          if (end) params.set('end_time', end)
          params.set('max_results', '100')
          const tlResp = await fetch(`https://api.twitter.com/2/users/${meData.data.id}/tweets?${params.toString()}`, {
            headers: { Authorization: `Bearer ${bearer}` },
          })
          if (tlResp.ok) {
            const tl = await tlResp.json()
            const items: CachedTweet[] = (tl.data || [])
              .map((tweet: any): CachedTweet => ({
                id: tweet.id,
                text: tweet.text,
                created_at: tweet.created_at,
                public_metrics: tweet.public_metrics || {
                  retweet_count: 0,
                  like_count: 0,
                  reply_count: 0,
                  impression_count: 0,
                },
              }))
              .slice(0, maxResults)
            setTweetsCacheEntry(cacheKey, items, Date.now())
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
        appSecret: credentials.apiKeySecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessTokenSecret,
      })

      const me = await client.v2.me()
      const tweets = await client.v2.userTimeline(me.data.id, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'context_annotations'],
      })

      console.log('✅ Real tweets fetched (OAuth 1.0a)')
      const items: CachedTweet[] = tweets.data.data?.map((tweet): CachedTweet => ({
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
      const filtered = items
        .filter(t => {
          if (!t.created_at) return false
          const ts = Date.parse(t.created_at)
          if (start && ts < Date.parse(start)) return false
          if (end && ts > Date.parse(end)) return false
          return true
        })
        .slice(0, maxResults)
      setTweetsCacheEntry(cacheKey, filtered, Date.now())
      return NextResponse.json({ success: true, mock: false, tweets: filtered })
    } catch (apiError: any) {
      const errorInfo = (() => { try { return JSON.parse(JSON.stringify(apiError)) } catch { return { message: apiError?.message || 'Unknown error' } } })()
      console.log('⚠️ Twitter API error:', errorInfo)
      ;(globalThis as any).__last_tweets_error = errorInfo
    }

    // Try cached tweets (rate limit/backoff)
    const cached = getFreshTweetsCacheEntry(cacheKey, Date.now())
    if (cached) {
      console.log('♻️ Serving cached tweets due to API failure/rate limit')
      const sliced = cached.data.slice(0, maxResults)
      return NextResponse.json({ success: true, mock: false, cached: true, tweets: sliced, note: 'Served cached tweets due to rate limit or error' })
    }

    console.log('❌ Twitter API unavailable; returning empty tweets')
    return NextResponse.json({
      success: false,
      mock: false,
      tweets: [],
      error: 'Twitter API call failed',
      note: 'Could not load tweets from X. Try again or check credentials.',
      details: (globalThis as any).__last_tweets_error,
    }, { status: 502 })

  } catch (error) {
    console.error('❌ Tweets fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tweets',
        mock: false,
        tweets: [],
      },
      { status: 500 }
    )
  }
}
