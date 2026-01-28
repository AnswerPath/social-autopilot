"use server"

import { TwitterApi } from 'twitter-api-v2'
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

// Get stored credentials and create Twitter client
async function getTwitterClient(userId: string = 'demo-user') {
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
  
  const credentials = result.credentials
  
  // Create Twitter client with OAuth 1.0a credentials
  const client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret,
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
    
    const tweet = await client.tweet(text, mediaOptions)
    
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
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - returning mock tweets')
      return {
        success: true,
        data: generateMockTweets(maxResults),
        error: 'Using demo credentials - mock data returned'
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
      success: true,
      data: generateMockTweets(maxResults),
      error: `API Error: ${error.message}. Returning mock data.`
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
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - returning mock mentions')
      return {
        success: true,
        data: generateMockMentions(maxResults),
        error: 'Using demo credentials - mock data returned'
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
      success: true,
      data: generateMockMentions(maxResults),
      error: `API Error: ${error.message}. Returning mock data.`
    }
  }
}

// Get user profile information
export async function getUserProfile(
  userId: string = 'demo-user'
): Promise<{ success: boolean; data?: TwitterUser; error?: string }> {
  try {
    const { client, credentials } = await getTwitterClient(userId)
    
    // Check if using demo credentials
    if (credentials.apiKey.includes('demo_')) {
      console.log('⚠️ Demo credentials detected - returning mock profile')
      return {
        success: true,
        data: {
          id: '123456789',
          username: 'demo_user',
          name: 'Demo User',
          profile_image_url: '/placeholder.svg?height=100&width=100',
          public_metrics: {
            followers_count: 1000,
            following_count: 500,
            tweet_count: 250
          }
        },
        error: 'Using demo credentials - mock data returned'
      }
    }
    
    console.log('👤 Fetching user profile via Twitter API v2')
    
    const user = await client.me({
      'user.fields': ['profile_image_url', 'public_metrics', 'description']
    })
    
    const userData: TwitterUser = {
      id: user.data.id,
      username: user.data.username,
      name: user.data.name,
      profile_image_url: user.data.profile_image_url || '/placeholder.svg?height=100&width=100',
      public_metrics: user.data.public_metrics || {
        followers_count: 0,
        following_count: 0,
        tweet_count: 0
      }
    }
    
    console.log('✅ User profile fetched:', userData.username)
    
    return {
      success: true,
      data: userData
    }
  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error)
    return {
      success: true,
      data: {
        id: '987654321',
        username: 'your_account',
        name: 'Your Twitter Account',
        profile_image_url: '/placeholder.svg?height=100&width=100',
        public_metrics: {
          followers_count: 0,
          following_count: 0,
          tweet_count: 0
        }
      },
      error: `API Error: ${error.message}. Returning mock data.`
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
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
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

// Generate mock tweets for fallback/demo
function generateMockTweets(count: number): TwitterPost[] {
  const mockTweets: TwitterPost[] = []
  const now = Date.now()
  
  for (let i = 0; i < Math.min(count, 5); i++) {
    mockTweets.push({
      id: `mock_${i + 1}`,
      text: [
        'Just deployed a new feature to Social Autopilot! 🚀 #webdev #automation',
        'The analytics dashboard is looking great with real-time data updates 📊',
        'Working on scheduling improvements for better tweet timing ⏰',
        'Thanks for all the feedback on the new UI! Your suggestions are being implemented 🙏',
        'Social media automation doesn\'t have to be complicated. Keep it simple! 💡'
      ][i] || `Mock tweet #${i + 1}`,
      created_at: new Date(now - (i * 4 * 60 * 60 * 1000)).toISOString(),
      public_metrics: {
        retweet_count: Math.floor(Math.random() * 20),
        like_count: Math.floor(Math.random() * 50),
        reply_count: Math.floor(Math.random() * 10),
        impression_count: Math.floor(Math.random() * 500)
      },
      author_id: 'mock_user_id'
    })
  }
  
  return mockTweets
}

// Generate mock mentions for fallback/demo
function generateMockMentions(count: number): TwitterMention[] {
  const mockMentions: TwitterMention[] = []
  const now = Date.now()
  
  const templates = [
    { text: 'Hey @you, love the new automation features!', sentiment: 'positive' as const },
    { text: '@you Quick question about the API integration...', sentiment: 'neutral' as const },
    { text: '@you This tool saved me hours of work! Thank you!', sentiment: 'positive' as const },
    { text: '@you Having an issue with scheduling, can you help?', sentiment: 'negative' as const },
    { text: '@you When will the analytics export feature be ready?', sentiment: 'neutral' as const }
  ]
  
  for (let i = 0; i < Math.min(count, templates.length); i++) {
    const template = templates[i]
    mockMentions.push({
      id: `mention_${i + 1}`,
      text: template.text,
      created_at: new Date(now - (i * 2 * 60 * 60 * 1000)).toISOString(),
      author_id: `user_${i + 1}`,
      username: `user_${i + 1}`,
      name: `Mock User ${i + 1}`,
      profile_image_url: '/placeholder.svg?height=40&width=40',
      public_metrics: {
        followers_count: Math.floor(Math.random() * 1000),
        following_count: Math.floor(Math.random() * 500)
      },
      sentiment: template.sentiment
    })
  }
  
  return mockMentions
}