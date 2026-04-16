import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedCredentials } from '@/lib/unified-credentials'
import { TwitterApi } from 'twitter-api-v2'
import { getCurrentUser } from '@/lib/auth-utils'

export const runtime = 'nodejs'

function isNonDemoXCredentials(credentials: {
  apiKey?: string | null
  apiSecret?: string | null
  accessToken?: string | null
  accessSecret?: string | null
}): boolean {
  const { apiKey, apiSecret, accessToken, accessSecret } = credentials
  return !!(
    apiKey &&
    apiSecret &&
    accessToken &&
    accessSecret &&
    !apiKey.includes('demo_') &&
    !apiSecret.includes('demo_') &&
    !accessToken.includes('demo_') &&
    !accessSecret.includes('demo_')
  )
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching mentions...')

    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', mentions: [], mock: false },
        { status: 401 }
      )
    }
    const userId = user.id

    const maxResultsRaw = request.nextUrl.searchParams.get('maxResults')
    const maxResultsParsed = maxResultsRaw != null ? parseInt(maxResultsRaw, 10) : NaN
    const maxResults = Number.isFinite(maxResultsParsed)
      ? Math.min(100, Math.max(1, maxResultsParsed))
      : 10

    const result = await getUnifiedCredentials(userId)

    if (!result.success || !result.credentials) {
      console.log('No credentials found for user')
      return NextResponse.json(
        {
          success: false,
          mentions: [],
          mock: true,
          requiresCredentials: true,
        },
        { status: 400 }
      )
    }

    const credentials = result.credentials

    const twitterCredentials = {
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiKeySecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    }

    if (!isNonDemoXCredentials(twitterCredentials)) {
      return NextResponse.json(
        {
          success: false,
          mentions: [],
          mock: true,
          requiresCredentials: true,
        },
        { status: 400 }
      )
    }

    if (result.migrated) {
      console.log('✅ Credentials migrated from Twitter to X API format')
    }

    try {
      const client = new TwitterApi({
        appKey: twitterCredentials.apiKey!,
        appSecret: twitterCredentials.apiSecret!,
        accessToken: twitterCredentials.accessToken!,
        accessSecret: twitterCredentials.accessSecret!,
      })

      const me = await client.v2.me()
      const mentions = await client.v2.userMentionTimeline(me.data.id, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
        expansions: ['author_id'],
      })

      console.log('✅ Real mentions fetched (OAuth 1.0a)')
      const users = mentions.includes?.users || []
      return NextResponse.json({
        success: true,
        mock: false,
        mentions:
          mentions.data.data?.map((mention) => {
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
              },
            }
          }) || [],
      })
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
        console.log('⚠️ Twitter API error:', errorMessage)
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Could not fetch mentions from X. Check credentials and API access.',
          mentions: [],
          mock: false,
        },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('❌ Mentions fetch error')
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error message:', errorMessage)
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch mentions',
        mentions: [],
        mock: false,
      },
      { status: 500 }
    )
  }
}
