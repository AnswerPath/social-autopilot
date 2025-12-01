import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedCredentials } from '@/lib/unified-credentials'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching mentions...')
    
    const userId = request.headers.get('x-user-id') || 'demo-user'
    const result = await getUnifiedCredentials(userId)
    
    if (!result.success || !result.credentials) {
      console.log(`❌ No credentials found for user ${userId}, checking for demo mentions in database`)
      // Try to get mentions from database (demo mode)
      // Only return demo mentions (tweet_id starts with 'demo-')
      try {
        const { supabaseAdmin } = await import('@/lib/supabase')
        const { data: mentions, error } = await supabaseAdmin
          .from('mentions')
          .select('*')
          .eq('user_id', userId)
          .like('tweet_id', 'demo-%') // Only get demo mentions
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (error) {
          console.error('❌ Database error fetching mentions:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
        } else {
          console.log(`✅ Found ${mentions?.length || 0} mentions in database for ${userId}`)
          if (mentions && mentions.length > 0) {
            // Check sentiment distribution in raw database data
            const rawSentimentCounts = mentions.reduce((acc, m) => {
              const sent = m.sentiment || 'NULL'
              acc[sent] = (acc[sent] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            console.log('📊 Raw database sentiment counts:', rawSentimentCounts)
            console.log('Sample mention (raw):', {
              text: mentions[0].text?.substring(0, 50) + '...',
              sentiment: mentions[0].sentiment,
              sentiment_confidence: mentions[0].sentiment_confidence
            })
          }
        }
        
        if (!error && mentions && mentions.length > 0) {
          // Convert database mentions to expected format
          const formattedMentions = mentions.map(mention => ({
            id: mention.tweet_id || mention.id,
            text: mention.text,
            created_at: mention.created_at,
            username: mention.author_username,
            name: mention.author_name || mention.author_username,
            profile_image_url: '/placeholder.svg?height=40&width=40',
            public_metrics: {
              followers_count: Math.floor(Math.random() * 5000) + 100, // Random followers for demo
              following_count: Math.floor(Math.random() * 1000) + 50,
            },
            sentiment: mention.sentiment || 'neutral',
          }))
          
          // Log sentiment distribution for debugging
          const sentimentCounts = formattedMentions.reduce((acc, m) => {
            const sent = m.sentiment || 'neutral'
            acc[sent] = (acc[sent] || 0) + 1
            return acc
          }, {} as Record<string, number>)
          console.log(`✅ Returning ${formattedMentions.length} formatted mentions from database`)
          console.log(`📊 Sentiment distribution:`, sentimentCounts)
          console.log(`📊 Sample sentiments (first 5):`, formattedMentions.slice(0, 5).map(m => ({ text: m.text.substring(0, 40) + '...', sentiment: m.sentiment })))
          
          return NextResponse.json({ 
            success: true,
            mock: true,
            demo: true,
            mentions: formattedMentions
          })
        } else if (!error && mentions && mentions.length === 0) {
          console.log(`ℹ️ No mentions found in database for ${userId} - returning empty array`)
          return NextResponse.json({ 
            success: true,
            mock: true,
            demo: true,
            mentions: []
          })
        }
      } catch (dbError) {
        console.error('❌ Error fetching demo mentions from database:', dbError)
        console.error('DB Error details:', JSON.stringify(dbError, null, 2))
      }
      
      // Fallback to mock mentions if no database mentions
      console.log('📊 Falling back to mock mentions')
      return NextResponse.json({ 
        success: true,
        mock: true,
        mentions: generateMockMentions(false)
      })
    }

    const credentials = result.credentials

    // Convert unified credentials format to Twitter API format
    const twitterCredentials = {
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiKeySecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
      bearerToken: undefined // X API doesn't use bearer token in this format
    }

    // Prefer Bearer token first (if available in future)
    if (twitterCredentials.bearerToken && !twitterCredentials.bearerToken.includes('demo_')) {
      try {
        const meResp = await fetch('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${twitterCredentials.bearerToken}` },
        })
        if (meResp.ok) {
          const me = await meResp.json()
          const params = new URLSearchParams({ 'tweet.fields': 'created_at,public_metrics,author_id', 'user.fields': 'username,name,profile_image_url,public_metrics', expansions: 'author_id', 'max_results': '50' })
          const res = await fetch(`https://api.twitter.com/2/users/${me.data.id}/mentions?${params.toString()}`, {
            headers: { Authorization: `Bearer ${twitterCredentials.bearerToken}` },
          })
          if (res.ok) {
            const data = await res.json()
            const users = data.includes?.users || []
            const mapped = (data.data || []).map((mention: any) => {
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
            })
            console.log('✅ Real mentions fetched (Bearer)')
            return NextResponse.json({ success: true, mock: false, mentions: mapped })
          } else {
            const err = await res.json().catch(() => ({}))
            const errorInfo = { status: res.status, error: err }
            console.log('⚠️ Bearer mentions failed, trying OAuth 1.0a:', errorInfo)
            ;(globalThis as any).__last_mentions_error = errorInfo
          }
        } else {
          const err = await meResp.json().catch(() => ({}))
          const errorInfo = { status: meResp.status, error: err }
          console.log('⚠️ Bearer me failed, trying OAuth 1.0a:', errorInfo)
          ;(globalThis as any).__last_mentions_error = errorInfo
        }
      } catch (e: any) {
        const errorInfo = { message: e?.message || 'Unknown bearer error' }
        console.log('⚠️ Bearer mentions error, trying OAuth 1.0a:', errorInfo)
        ;(globalThis as any).__last_mentions_error = errorInfo
      }
    }

    // Fallback to OAuth 1.0a
    try {
      const client = new TwitterApi({
        appKey: twitterCredentials.apiKey,
        appSecret: twitterCredentials.apiSecret,
        accessToken: twitterCredentials.accessToken,
        accessSecret: twitterCredentials.accessSecret,
      })

      const me = await client.v2.me()
      const mentions = await client.v2.userMentionTimeline(me.data.id, {
        max_results: 10,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
        expansions: ['author_id'],
      })

      console.log('✅ Real mentions fetched (OAuth 1.0a)')
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
      console.log('⚠️ Twitter API error, checking database for demo mentions before fallback:', errorInfo)
      ;(globalThis as any).__last_mentions_error = errorInfo
    }

    // Check if credentials are real (not demo) before falling back to database
    const isRealCredentials = twitterCredentials.apiKey && 
      !twitterCredentials.apiKey.includes('demo_') && 
      !twitterCredentials.apiSecret?.includes('demo_') &&
      !twitterCredentials.accessToken?.includes('demo_') &&
      !twitterCredentials.accessSecret?.includes('demo_')
    
    if (result.migrated) {
      console.log('✅ Credentials migrated from Twitter to X API format');
    }

    // Before falling back to mock data, check database for demo mentions
    // BUT only if we don't have real credentials (to avoid mixing demo and real data)
    if (!isRealCredentials) {
      console.log(`🔍 Checking database for demo mentions (user: ${userId}) before mock fallback`)
      try {
        const { supabaseAdmin } = await import('@/lib/supabase')
        const { data: mentions, error } = await supabaseAdmin
          .from('mentions')
          .select('*')
          .eq('user_id', userId)
          .like('tweet_id', 'demo-%') // Only get demo mentions
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (!error && mentions && mentions.length > 0) {
          console.log(`✅ Found ${mentions.length} demo mentions in database - returning them instead of mock data`)
          // Convert database mentions to expected format
          const formattedMentions = mentions.map(mention => ({
            id: mention.tweet_id || mention.id,
            text: mention.text,
            created_at: mention.created_at,
            username: mention.author_username,
            name: mention.author_name || mention.author_username,
            profile_image_url: '/placeholder.svg?height=40&width=40',
            public_metrics: {
              followers_count: Math.floor(Math.random() * 5000) + 100, // Random followers for demo
              following_count: Math.floor(Math.random() * 1000) + 50,
            },
            sentiment: mention.sentiment || 'neutral',
          }))
          
          // Log sentiment distribution for debugging
          const sentimentCounts = formattedMentions.reduce((acc, m) => {
            const sent = m.sentiment || 'neutral'
            acc[sent] = (acc[sent] || 0) + 1
            return acc
          }, {} as Record<string, number>)
          console.log(`📊 Sentiment distribution (API fallback):`, sentimentCounts)
          console.log(`📊 Sample sentiments (first 5):`, formattedMentions.slice(0, 5).map(m => ({ text: m.text.substring(0, 40) + '...', sentiment: m.sentiment })))
          
          return NextResponse.json({ 
            success: true,
            mock: true,
            demo: true,
            mentions: formattedMentions,
            note: 'Twitter API call failed; returning demo mentions from database'
          })
        } else if (!error && mentions && mentions.length === 0) {
          console.log(`ℹ️ No demo mentions in database for ${userId} - will fall back to mock data`)
        } else if (error) {
          console.error('❌ Database error while checking for demo mentions:', error)
        }
      } catch (dbError) {
        console.error('❌ Error checking database for demo mentions:', dbError)
      }
    } else {
      console.log('🔒 Real credentials detected - skipping demo mentions from database to avoid mixing demo and real data')
    }

    // Enhanced mock data (only if no database mentions found)
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
