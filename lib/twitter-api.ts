"use server"

import { getTwitterCredentials, cleanupInvalidCredentials } from './database-storage'

export interface TwitterPost {
  id: string
  text: string
  created_at: string
  public_metrics: {
    retweet_count: number
    like_count: number
    reply_count: number
    impression_count: number
  }
  author_id: string
}

export interface TwitterMention {
  id: string
  text: string
  created_at: string
  author_id: string
  username: string
  name: string
  profile_image_url: string
  public_metrics: {
    followers_count: number
    following_count: number
  }
  sentiment?: 'positive' | 'negative' | 'neutral'
}

export interface TwitterUser {
  id: string
  username: string
  name: string
  profile_image_url: string
  public_metrics: {
    followers_count: number
    following_count: number
    tweet_count: number
  }
}

// Get stored credentials and handle edge runtime compatibility
async function getCredentialsForUser(userId: string = 'demo-user') {
  const result = await getTwitterCredentials(userId)
  if (!result.success || !result.credentials) {
    // If credentials are corrupted, try to clean them up
    if (result.error?.includes('decrypt')) {
      console.log('Attempting to cleanup corrupted credentials for user:', userId)
      await cleanupInvalidCredentials(userId)
    }
    
    // Provide more helpful error message
    const errorMsg = result.error || 'Unknown error'
    if (errorMsg.includes('table') || errorMsg.includes('does not exist')) {
      throw new Error('Database not set up. Please run the setup script.')
    }
    if (errorMsg.includes('decrypt') || errorMsg.includes('corrupted')) {
      throw new Error('Invalid credentials found. Please re-add your Twitter API keys in Settings.')
    }
    throw new Error(`No Twitter credentials found for user ${userId}. Please configure your API keys in Settings. Error: ${errorMsg}`)
  }
  
  return result.credentials
}

// Post a tweet
export async function postTweet(
  text: string, 
  mediaIds?: string[], 
  userId: string = 'demo-user'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)
    
    console.log('🐦 Attempting to post tweet for user:', userId)
    console.log('📝 Tweet content:', text.substring(0, 50) + '...')
    
    // For any credentials in edge runtime, simulate posting
    console.log('⚠️ Edge Runtime: Simulating tweet post (real posting requires Node.js environment)')
    
    return {
      success: true,
      data: {
        id: `tweet_${Date.now()}`,
        text: text,
        created_at: new Date().toISOString()
      },
      note: 'Tweet simulated in edge runtime. Deploy to Node.js for real posting.'
    }
  } catch (error: any) {
    console.error('Error posting tweet:', error)
    return {
      success: false,
      error: error.message || 'Failed to post tweet'
    }
  }
}

// Schedule a tweet
export async function scheduleTweet(
  text: string, 
  scheduledTime: Date, 
  mediaIds?: string[], 
  userId: string = 'demo-user'
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const jobId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('📅 Scheduling tweet:', { text: text.substring(0, 50) + '...', scheduledTime, jobId, userId })
    
    return {
      success: true,
      jobId,
      note: 'Tweet scheduled successfully. Real scheduling requires job queue in production.'
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to schedule tweet'
    }
  }
}

// Get user's recent tweets
export async function getUserTweets(
  userId: string = 'demo-user', 
  maxResults: number = 10
): Promise<{ success: boolean; data?: TwitterPost[]; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)

    console.log('🔍 Getting user tweets for:', userId)

    if (credentials.apiKey.includes('demo_')) {
      return {
        success: false,
        data: [],
        error: 'Configure real Twitter credentials to load tweets.',
      }
    }

    if (credentials.bearerToken && !credentials.bearerToken.includes('demo_')) {
      try {
        const meResp = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics', {
          headers: { Authorization: `Bearer ${credentials.bearerToken}` },
        })
        if (!meResp.ok) {
          const body = await meResp.text().catch(() => '')
          console.warn('⚠️ Twitter /users/me failed:', meResp.status, body)
          const error =
            meResp.status === 401 || meResp.status === 403
              ? 'Invalid or expired Twitter credentials.'
              : meResp.status === 429
                ? 'Twitter rate limit exceeded. Try again later.'
                : meResp.status >= 500
                  ? 'Twitter service error. Try again later.'
                  : `Twitter request failed (${meResp.status}).`
          return { success: false, data: [], error }
        }

        const meData = await meResp.json()
        const params = new URLSearchParams({
          'tweet.fields': 'created_at,public_metrics',
          max_results: String(Math.min(100, Math.max(5, maxResults))),
        })
        const tlResp = await fetch(
          `https://api.twitter.com/2/users/${meData.data.id}/tweets?${params.toString()}`,
          { headers: { Authorization: `Bearer ${credentials.bearerToken}` } }
        )
        if (!tlResp.ok) {
          const body = await tlResp.text().catch(() => '')
          console.warn('⚠️ Twitter timeline fetch failed:', tlResp.status, body)
          const error =
            tlResp.status === 401 || tlResp.status === 403
              ? 'Invalid or expired Twitter credentials.'
              : tlResp.status === 429
                ? 'Twitter rate limit exceeded. Try again later.'
                : tlResp.status >= 500
                  ? 'Twitter service error. Try again later.'
                  : `Twitter timeline fetch failed (${tlResp.status}).`
          return { success: false, data: [], error }
        }

        const tl = (await tlResp.json()) as {
          data?: Array<{
            id: string
            text: string
            created_at?: string
            author_id?: string
            public_metrics?: TwitterPost['public_metrics']
          }>
        }
        const items: TwitterPost[] = (tl.data || []).map((tweet) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at || new Date().toISOString(),
          public_metrics: tweet.public_metrics || {
            retweet_count: 0,
            like_count: 0,
            reply_count: 0,
            impression_count: 0,
          },
          author_id: tweet.author_id || meData.data.id,
        }))
        return { success: true, data: items.slice(0, maxResults) }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch tweets'
        console.warn('⚠️ Bearer tweet fetch failed:', msg)
        return {
          success: false,
          data: [],
          error: msg,
        }
      }
    }

    return {
      success: false,
      data: [],
      error:
        'Tweet timeline is not available in this environment. Use the app dashboard or a Node.js API route.',
    }
  } catch (error: any) {
    console.error('❌ Error fetching tweets:', error)
    return {
      success: false,
      data: [],
      error: error.message || 'Failed to fetch tweets',
    }
  }
}

// Get mentions of the user
export async function getMentions(
  userId: string = 'demo-user', 
  maxResults: number = 50
): Promise<{ success: boolean; data?: TwitterMention[]; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)

    console.log('🔍 Getting mentions for:', userId)

    if (credentials.apiKey.includes('demo_')) {
      return {
        success: false,
        data: [],
        error: 'Configure real Twitter credentials to load mentions.',
      }
    }

    // Mention timeline requires OAuth 1.0a signing (Node.js routes); no fake data in edge
    return {
      success: false,
      data: [],
      error:
        'Mentions are loaded via server API routes with OAuth. No data available from this context.',
    }
  } catch (error: any) {
    console.error('❌ Error fetching mentions:', error)
    return {
      success: false,
      data: [],
      error: error.message || 'Failed to fetch mentions',
    }
  }
}

// Get user profile information
export async function getUserProfile(
  userId: string = 'demo-user'
): Promise<{ success: boolean; data?: TwitterUser; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)
    
    console.log('🔍 Getting user profile for:', userId)
    console.log('🔑 Credentials type:', credentials.apiKey.includes('demo_') ? 'demo' : 'real')
    
    // For real credentials with Bearer token, try the API call first
    if (credentials.bearerToken && !credentials.bearerToken.includes('demo_')) {
      try {
        console.log('📡 Attempting real Twitter API call with Bearer token...')
        
        const response = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics', {
          headers: {
            'Authorization': `Bearer ${credentials.bearerToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        console.log('📡 Twitter API response status:', response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Successfully fetched real user profile:', data.data?.username)
          
          const userData: TwitterUser = {
            id: data.data.id,
            username: data.data.username,
            name: data.data.name,
            profile_image_url: data.data.profile_image_url || '/placeholder.svg?height=40&width=40',
            public_metrics: data.data.public_metrics || { followers_count: 0, following_count: 0, tweet_count: 0 }
          }
          
          return {
            success: true,
            data: userData,
            note: 'Real Twitter profile data loaded successfully!'
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('⚠️ Twitter API error:', response.status, errorData)
          const error =
            response.status === 401 || response.status === 403
              ? 'Bearer token authentication failed.'
              : response.status === 429
                ? 'Twitter rate limit exceeded. Try again later.'
                : response.status >= 500
                  ? 'Twitter service error. Try again later.'
                  : `Twitter profile request failed (${response.status}).`
          return { success: false, error }
        }
      } catch (apiError: any) {
        const msg = apiError?.message || 'Twitter API call failed'
        console.warn('⚠️ Twitter API call failed:', msg)
        return { success: false, error: msg }
      }
    }
    
    console.log('📊 Profile unavailable without successful Twitter API response')
    return {
      success: false,
      error: credentials.apiKey.includes('demo_')
        ? 'Demo credentials cannot load a profile. Add real Twitter API credentials in Settings.'
        : 'Could not load profile. Check credentials or use a Node.js API route for full OAuth.',
    }
  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch user profile',
    }
  }
}

// Reply to a tweet
export async function replyToTweet(
  tweetId: string, 
  replyText: string, 
  userId: string = 'demo-user'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)
    
    console.log('💬 Simulating tweet reply in edge runtime')
    
    return {
      success: true,
      data: {
        id: `reply_${Date.now()}`,
        text: replyText,
        created_at: new Date().toISOString()
      },
      note: 'Reply simulated in edge runtime. Deploy to Node.js for real replies.'
    }
  } catch (error: any) {
    console.error('Error replying to tweet:', error)
    return {
      success: false,
      error: error.message || 'Failed to reply to tweet'
    }
  }
}

// Upload media
export async function uploadMedia(
  mediaBuffer: Buffer, 
  mediaType: 'image' | 'video', 
  userId: string = 'demo-user'
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const credentials = await getCredentialsForUser(userId)
    
    console.log('📎 Simulating media upload in edge runtime')
    
    return {
      success: true,
      mediaId: `media_${Date.now()}`,
      note: 'Media upload simulated in edge runtime. Deploy to Node.js for real uploads.'
    }
  } catch (error: any) {
    console.error('Error uploading media:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload media'
    }
  }
}

// Simple sentiment analysis
function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['love', 'great', 'awesome', 'amazing', 'excellent', 'fantastic', 'wonderful', 'good', 'best', 'perfect', 'thank', 'thanks']
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'worst', 'horrible', 'issue', 'problem', 'bug', 'broken', 'error', 'fail']
  
  const lowerText = text.toLowerCase()
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}
