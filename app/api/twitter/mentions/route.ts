import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedCredentials } from '@/lib/unified-credentials'
import { TwitterApi } from 'twitter-api-v2'

export const runtime = 'nodejs'

/**
 * Format a database mention to the expected API format
 */
function formatMentionFromDb(mention: any) {
  // Deterministic hash-based metrics (same mention always gets same values)
  const seed = String(mention.tweet_id || mention.id || '');
  const hash = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  
  return {
    id: mention.tweet_id || mention.id,
    text: mention.text,
    created_at: mention.created_at,
    username: mention.author_username,
    name: mention.author_name || mention.author_username,
    profile_image_url: '/placeholder.svg?height=40&width=40',
    public_metrics: {
      followers_count: (hash % 5000) + 100,
      following_count: (hash % 1000) + 50,
    },
    sentiment: mention.sentiment || 'neutral',
  };
}

/**
 * Fetch demo mentions from database and format them
 * 
 * SECURITY NOTE: userId should be derived from server-side auth context (session/JWT)
 * and NOT from client-controlled headers when using supabaseAdmin (service role).
 * This function currently accepts userId as a parameter, but callers must ensure
 * it comes from authenticated session, not request headers.
 */
async function fetchDemoMentionsFromDb(userId: string): Promise<{ mentions: any[]; found: boolean }> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase');
    const { data: mentions, error } = await supabaseAdmin
      .from('mentions')
      .select('*')
      .eq('user_id', userId)
      .like('tweet_id', 'demo-%')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Only log sanitized error metadata, not full error objects or user content
      console.error('❌ Database error fetching mentions');
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
        console.error('Error message:', error.message);
      }
      return { mentions: [], found: false };
    }

    if (!mentions || mentions.length === 0) {
      return { mentions: [], found: false };
    }

    // Log sentiment distribution in raw database data (only in debug mode)
    const rawSentimentCounts = mentions.reduce((acc, m) => {
      const sent = m.sentiment || 'NULL';
      acc[sent] = (acc[sent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (process.env.DEBUG_MENTIONS === '1') {
      console.log('📊 Raw database sentiment counts:', rawSentimentCounts);
    }

    // Convert database mentions to expected format
    const formattedMentions = mentions.map(formatMentionFromDb);

    // Log sentiment distribution for debugging (only in debug mode, no user content)
    if (process.env.DEBUG_MENTIONS === '1') {
      const sentimentCounts = formattedMentions.reduce((acc, m) => {
        const sent = m.sentiment || 'neutral';
        acc[sent] = (acc[sent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`✅ Found ${formattedMentions.length} formatted mentions from database`);
      console.log(`📊 Sentiment distribution:`, sentimentCounts);
    }

    return { mentions: formattedMentions, found: true };
  } catch (dbError) {
    // Only log sanitized error metadata
    console.error('❌ Error fetching demo mentions from database');
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      console.error('Error message:', errorMessage);
    }
    return { mentions: [], found: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching mentions...')
    
    // TODO: SECURITY - Derive userId from server-side auth context (session/JWT)
    // Do not trust client-controlled headers when using supabaseAdmin (service role)
    // This is a temporary implementation - replace with actual auth integration
    // For now, using 'demo-user' as a safe default instead of trusting headers
    const userId = 'demo-user'; // TODO: Replace with authenticated user ID from session
    
    const result = await getUnifiedCredentials(userId)
    
    if (!result.success || !result.credentials) {
      console.log(`❌ No credentials found for user ${userId}, checking for demo mentions in database`)
      // Try to get mentions from database (demo mode)
      const { mentions, found } = await fetchDemoMentionsFromDb(userId);
      
      if (found) {
        return NextResponse.json({ 
          success: true,
          mock: true,
          demo: true,
          mentions
        });
      } else {
        console.log(`ℹ️ No mentions found in database for ${userId} - returning empty array`)
        return NextResponse.json({ 
          success: true,
          mock: true,
          demo: true,
          mentions: []
        });
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
    }

    // Use OAuth 1.0a (Bearer token support removed as X API doesn't use it in this format)
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
      // Log sanitized error only, don't store on globalThis
      const errorMessage = apiError?.message || 'Unknown error';
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
        console.log('⚠️ Twitter API error, checking database for demo mentions before fallback:', errorMessage);
      }
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
    // NOTE: userId here should come from authenticated session, not client headers
    if (!isRealCredentials) {
      if (process.env.DEBUG_MENTIONS === '1') {
        console.log(`🔍 Checking database for demo mentions before mock fallback`);
      }
      const { mentions, found } = await fetchDemoMentionsFromDb(userId);
      
      if (found) {
        console.log(`✅ Found ${mentions.length} demo mentions in database - returning them instead of mock data`)
        return NextResponse.json({ 
          success: true,
          mock: true,
          demo: true,
          mentions,
          note: 'Twitter API call failed; returning demo mentions from database'
        });
      } else {
        console.log(`ℹ️ No demo mentions in database for ${userId} - will fall back to mock data`)
      }
    } else {
      console.log('🔒 Real credentials detected - skipping demo mentions from database to avoid mixing demo and real data')
    }

    // Enhanced mock data (only if no database mentions found)
    if (process.env.DEBUG_MENTIONS === '1') {
      console.log('📊 Using enhanced mock data with real credentials');
    }
    return NextResponse.json({
      success: true,
      mock: true,
      enhanced: true,
      mentions: generateMockMentions(true),
      note: 'Twitter API call failed; returning enhanced mock data'
      // Avoid returning internal error objects to clients
    })

  } catch (error) {
    // Log sanitized error only
    console.error('❌ Mentions fetch error');
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MENTIONS === '1') {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error message:', errorMessage);
    }
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
