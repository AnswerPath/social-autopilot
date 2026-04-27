"use server"

import { TwitterApi } from 'twitter-api-v2'
import { cleanupInvalidCredentials } from './database-storage'
import { getUnifiedCredentials } from './unified-credentials'

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

// Get stored credentials and create Twitter client (x-api row or legacy twitter, auto-migrated)
async function getTwitterClient(userId: string = 'demo-user') {
  const result = await getUnifiedCredentials(userId)
  if (!result.success || !result.credentials) {
    if (
      result.errorCode === 'decryption_failed' ||
      result.errorCode === 'invalid_encrypted' ||
      result.error?.includes('decrypt')
    ) {
      console.log('Attempting to cleanup corrupted credentials for user:', userId)
      await cleanupInvalidCredentials(userId)
    }

    const errorMsg = result.error || 'Unknown error'
    if (errorMsg.includes('table') || errorMsg.includes('does not exist')) {
      throw new Error('Database not set up. Please run the setup script.')
    }
    if (errorMsg.includes('decrypt') || errorMsg.includes('corrupted')) {
      throw new Error('Invalid credentials found. Please re-add your X API keys in Settings → Integrations.')
    }
    throw new Error(
      `No X API credentials found for user ${userId}. Configure them in Settings → Integrations. Error: ${errorMsg}`
    )
  }

  const credentials = result.credentials

  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiKeySecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessTokenSecret,
  })

  return { client: client.v2, credentials }
}

// Post a tweet
export async function postTweet(
  text: string, 
  mediaIds?: string[], 
  userId: string = 'demo-user'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { client, credentials } = await getTwitterClient(userId)
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - simulating tweet post')
      return {
        success: true,
        data: {
          id: `demo_tweet_${Date.now()}`,
          text: text,
          created_at: new Date().toISOString()
        },
        error: 'Using demo credentials - tweet simulated'
      }
    }
    
    console.log('🐦 Posting tweet via Twitter API v2')
    
    // Only include media if we have actual media IDs (not empty array)
    const mediaOptions = mediaIds && mediaIds.length > 0 
      ? { media: { media_ids: mediaIds } }
      : undefined
    
    const tweet =
      mediaOptions !== undefined
        ? await client.tweet(text, mediaOptions)
        : await client.tweet(text)
    
    console.log('✅ Tweet posted successfully:', tweet.data.id)
    
    return {
      success: true,
      data: tweet.data
    }
  } catch (error: any) {
    console.error('❌ Error posting tweet:', error)
    return {
      success: false,
      error: error.message || 'Failed to post tweet'
    }
  }
}

// Get user's recent tweets
export async function getUserTweets(
  userId: string = 'demo-user', 
  maxResults: number = 10
): Promise<{ success: boolean; data?: TwitterPost[]; error?: string }> {
  try {
    const { client, credentials } = await getTwitterClient(userId)
    
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials — no tweets returned')
      return {
        success: false,
        data: [],
        error: 'Demo API keys cannot load tweets. Add real Twitter credentials in Settings.',
      }
    }
    
    console.log('📊 Fetching user timeline via Twitter API v2')
    
    // Get authenticated user's ID first
    const me = await client.me()
    const userTweets = await client.userTimeline(me.data.id, {
      max_results: maxResults,
      'tweet.fields': ['created_at', 'public_metrics', 'author_id']
    })
    
    const tweets: TwitterPost[] = userTweets.data?.data?.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at || new Date().toISOString(),
      public_metrics: tweet.public_metrics || {
        retweet_count: 0,
        like_count: 0,
        reply_count: 0,
        impression_count: 0
      },
      author_id: tweet.author_id || me.data.id
    })) || []
    
    console.log(`✅ Fetched ${tweets.length} tweets`)
    
    return {
      success: true,
      data: tweets
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
    const { client, credentials } = await getTwitterClient(userId)
    
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials — no mentions returned')
      return {
        success: false,
        data: [],
        error: 'Demo API keys cannot load mentions. Add real Twitter credentials in Settings.',
      }
    }
    
    console.log('📊 Fetching mentions via Twitter API v2')
    
    // Get authenticated user's ID first
    const me = await client.me()
    const mentions = await client.userMentionTimeline(me.data.id, {
      max_results: maxResults,
      'tweet.fields': ['created_at', 'author_id'],
      'user.fields': ['username', 'name', 'profile_image_url', 'public_metrics'],
      expansions: ['author_id']
    })
    
    const users = mentions.includes?.users || []
    const mentionsList: TwitterMention[] = mentions.data?.data?.map(mention => {
      const author = users.find(u => u.id === mention.author_id)
      return {
        id: mention.id,
        text: mention.text,
        created_at: mention.created_at || new Date().toISOString(),
        author_id: mention.author_id || '',
        username: author?.username || 'unknown',
        name: author?.name || 'Unknown User',
        profile_image_url: author?.profile_image_url || '/placeholder.svg?height=40&width=40',
        public_metrics: {
          followers_count: author?.public_metrics?.followers_count || 0,
          following_count: author?.public_metrics?.following_count || 0
        },
        sentiment: analyzeSentiment(mention.text)
      }
    }) || []
    
    console.log(`✅ Fetched ${mentionsList.length} mentions`)
    
    return {
      success: true,
      data: mentionsList
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
    const { client, credentials } = await getTwitterClient(userId)
    
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials — no profile returned')
      return {
        success: false,
        error: 'Demo API keys cannot load a profile. Add real Twitter credentials in Settings.',
      }
    }
    
    console.log('👤 Fetching user profile via Twitter API v2')
    
    const user = await client.me({
      'user.fields': ['profile_image_url', 'public_metrics', 'description']
    })
    
    const pm = user.data.public_metrics
    const userData: TwitterUser = {
      id: user.data.id,
      username: user.data.username,
      name: user.data.name,
      profile_image_url: user.data.profile_image_url || '/placeholder.svg?height=100&width=100',
      public_metrics: {
        followers_count: pm?.followers_count ?? 0,
        following_count: pm?.following_count ?? 0,
        tweet_count: pm?.tweet_count ?? 0,
      },
    }
    
    console.log('✅ User profile fetched:', userData.username)
    
    return {
      success: true,
      data: userData
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
    const { client, credentials } = await getTwitterClient(userId)
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - simulating reply')
      return {
        success: true,
        data: {
          id: `demo_reply_${Date.now()}`,
          text: replyText,
          created_at: new Date().toISOString()
        },
        error: 'Using demo credentials - reply simulated'
      }
    }
    
    console.log('💬 Replying to tweet via Twitter API v2')
    
    const reply = await client.reply(replyText, tweetId)
    
    console.log('✅ Reply posted successfully:', reply.data.id)
    
    return {
      success: true,
      data: reply.data
    }
  } catch (error: any) {
    console.error('❌ Error replying to tweet:', error)
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
    const { client, credentials } = await getTwitterClient(userId)
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - simulating media upload')
      return {
        success: true,
        mediaId: `demo_media_${Date.now()}`,
        error: 'Using demo credentials - upload simulated'
      }
    }
    
    console.log('📎 Uploading media via Twitter API v1.1')
    
    // Note: Media upload uses v1.1 API
    const twitterV1 = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiKeySecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    }).v1
    
    const mediaId = await twitterV1.uploadMedia(mediaBuffer, { type: mediaType })
    
    console.log('✅ Media uploaded successfully:', mediaId)
    
    return {
      success: true,
      mediaId
    }
  } catch (error: any) {
    console.error('❌ Error uploading media:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload media'
    }
  }
}

// Schedule a tweet (requires external job queue in production)
export async function scheduleTweet(
  text: string, 
  scheduledTime: Date, 
  mediaIds?: string[], 
  userId: string = 'demo-user'
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // In production, this would integrate with a job queue like BullMQ or similar
    const jobId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('📅 Scheduling tweet:', { 
      text: text.substring(0, 50) + '...', 
      scheduledTime, 
      jobId, 
      userId 
    })
    
    // Store the scheduled tweet in database (implementation needed)
    // await storeScheduledTweet({ text, scheduledTime, mediaIds, userId, jobId })
    
    return {
      success: true,
      jobId,
      error: 'Tweet scheduled. Note: Requires job queue implementation for production.'
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to schedule tweet'
    }
  }
}

// Helper function to analyze sentiment
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
