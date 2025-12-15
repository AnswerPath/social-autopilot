import { TwitterApi } from 'twitter-api-v2';
import { ApiErrorHandler, ErrorType, CircuitBreaker } from './error-handling';

export interface XApiCredentials {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
}

export interface XPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  timestamp: string;
}

export class XApiService {
  private client: TwitterApi;
  private credentials: XApiCredentials;
  private circuitBreaker: CircuitBreaker;

  constructor(credentials: XApiCredentials) {
    this.credentials = credentials;
    this.client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiKeySecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    });
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Post content using the official X API
   */
  async postContent(content: string, mediaUrls?: string[]): Promise<XPostResult> {
    return this.circuitBreaker.execute(async () => {
      return ApiErrorHandler.executeWithRetry(
        async () => {
          try {
            let mediaIds: string[] = [];

            // Upload media if provided
            if (mediaUrls && mediaUrls.length > 0) {
              for (const mediaUrl of mediaUrls) {
                try {
                  // Download the media and upload to Twitter
                  const mediaResponse = await fetch(mediaUrl);
                  const mediaBuffer = await mediaResponse.arrayBuffer();
                  const mediaId = await this.client.v1.uploadMedia(Buffer.from(mediaBuffer), {
                    mimeType: this.getMimeType(mediaUrl),
                  });
                  mediaIds.push(mediaId);
                } catch (error) {
                  console.error('Failed to upload media:', error);
                  // Continue without this media
                }
              }
            }

            // Post the tweet
            const tweet = await this.client.v2.tweet({
              text: content,
              ...(mediaIds.length > 0 && { media: { media_ids: mediaIds as any } }),
            });

            return {
              success: true,
              postId: tweet.data.id,
              timestamp: new Date().toISOString(),
            };
          } catch (error) {
            throw ApiErrorHandler.normalizeError(error, 'x-api', {
              endpoint: 'tweet',
              userId: this.credentials.userId,
            });
          }
        },
        'x-api',
        undefined,
        { endpoint: 'tweet', userId: this.credentials.userId }
      );
    });
  }

  /**
   * Reply to a tweet using the official X API
   */
  async replyToTweet(tweetId: string, content: string, mediaUrls?: string[]): Promise<XPostResult> {
    try {
      let mediaIds: string[] = [];

      // Upload media if provided
      if (mediaUrls && mediaUrls.length > 0) {
        for (const mediaUrl of mediaUrls) {
          try {
            const mediaResponse = await fetch(mediaUrl);
            const mediaBuffer = await mediaResponse.arrayBuffer();
            const mediaId = await this.client.v1.uploadMedia(Buffer.from(mediaBuffer), {
              mimeType: this.getMimeType(mediaUrl),
            });
            mediaIds.push(mediaId);
          } catch (error) {
            console.error('Failed to upload media:', error);
          }
        }
      }

      // Reply to the tweet
      const tweet = await this.client.v2.tweet({
        text: content,
        reply: { in_reply_to_tweet_id: tweetId },
        ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } }),
      });

      return {
        success: true,
        postId: tweet.data.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('X API reply error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test the X API connection and credentials validity
   */
  async testConnection(): Promise<{ success: boolean; error?: string; user?: any }> {
    try {
      // Test the connection by getting user info
      const user = await this.client.v2.me();
      return { success: true, user: user.data };
    } catch (error) {
      console.error('X API connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(username: string): Promise<any> {
    try {
      const user = await this.client.v2.userByUsername(username, {
        'user.fields': ['description', 'public_metrics', 'profile_image_url', 'verified', 'created_at'],
      });

      if (user.data) {
        return {
          success: true,
          profile: user.data,
        };
      } else {
        return {
          success: false,
          error: 'User not found',
        };
      }
    } catch (error) {
      console.error('X API get user profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user's own tweets
   */
  async getUserTweets(userId: string, limit: number = 50, startTime?: Date, endTime?: Date): Promise<any> {
    try {
      const options: any = {
        max_results: Math.min(limit, 100), // X API max is 100 per request
        'tweet.fields': ['created_at', 'public_metrics', 'entities', 'text', 'id'],
      };

      if (startTime) {
        options.start_time = startTime.toISOString();
      }
      if (endTime) {
        options.end_time = endTime.toISOString();
      }

      const tweets = await this.client.v2.userTimeline(userId, options);

      return {
        success: true,
        tweets: tweets.data.data || [],
        meta: tweets.data.meta,
      };
    } catch (error) {
      console.error('X API get user tweets error:', error);
      return {
        success: false,
        tweets: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get analytics for a specific tweet
   * Note: X API v2 provides public_metrics in the tweet object, but detailed analytics
   * require Twitter API v2 with Academic Research access or Twitter Analytics API
   */
  async getTweetAnalytics(tweetId: string): Promise<{
    success: boolean;
    analytics?: {
      tweetId: string;
      impressions?: number;
      likes: number;
      retweets: number;
      replies: number;
      quotes: number;
      engagementRate?: number;
    };
    error?: string;
  }> {
    return this.circuitBreaker.execute(async () => {
      return ApiErrorHandler.executeWithRetry(
        async () => {
          try {
            // Fetch tweet with public_metrics
            const tweet = await this.client.v2.singleTweet(tweetId, {
              'tweet.fields': ['public_metrics', 'created_at', 'text'],
            });

            if (!tweet.data) {
              return {
                success: false,
                error: 'Tweet not found',
              };
            }

            const metrics = tweet.data.public_metrics || {};
            const totalEngagements = (metrics.like_count || 0) + 
                                    (metrics.retweet_count || 0) + 
                                    (metrics.reply_count || 0) + 
                                    (metrics.quote_count || 0);

            // Note: Impressions are not available in public_metrics without Analytics API access
            // We'll calculate engagement rate based on available metrics
            const engagementRate = totalEngagements > 0 ? 
              (totalEngagements / Math.max(1, metrics.impression_count || 1)) * 100 : 0;

            return {
              success: true,
              analytics: {
                tweetId: tweet.data.id,
                impressions: metrics.impression_count || undefined, // May be undefined without Analytics API
                likes: metrics.like_count || 0,
                retweets: metrics.retweet_count || 0,
                replies: metrics.reply_count || 0,
                quotes: metrics.quote_count || 0,
                engagementRate: engagementRate,
              },
            };
          } catch (error) {
            throw ApiErrorHandler.normalizeError(error, 'x-api', {
              endpoint: 'tweet-analytics',
              userId: this.credentials.userId,
            });
          }
        },
        'x-api',
        undefined,
        { endpoint: 'tweet-analytics', userId: this.credentials.userId }
      );
    });
  }

  /**
   * Get user-level analytics (follower metrics)
   */
  async getUserAnalytics(userId?: string): Promise<{
    success: boolean;
    analytics?: {
      followerCount: number;
      followingCount: number;
      tweetCount: number;
    };
    error?: string;
  }> {
    try {
      // Get current user's profile (me) or specified user
      const user = userId 
        ? await this.client.v2.user(userId, {
            'user.fields': ['public_metrics'],
          })
        : await this.client.v2.me({
            'user.fields': ['public_metrics'],
          });

      if (!user.data) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const metrics = user.data.public_metrics || {};

      return {
        success: true,
        analytics: {
          followerCount: metrics.followers_count || 0,
          followingCount: metrics.following_count || 0,
          tweetCount: metrics.tweet_count || 0,
        },
      };
    } catch (error) {
      console.error('X API get user analytics error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch ALL user tweets with their analytics
   * CRITICAL: Fetches from user's X timeline, NOT from scheduled_posts table
   */
  async getTweetsWithAnalytics(
    userId: string, 
    limit: number = 50, 
    startTime?: Date, 
    endTime?: Date
  ): Promise<{
    success: boolean;
    tweets?: Array<{
      id: string;
      text: string;
      created_at?: string;
      analytics: {
        likes: number;
        retweets: number;
        replies: number;
        quotes: number;
        impressions?: number;
        engagementRate?: number;
      };
    }>;
    meta?: any;
    error?: string;
  }> {
    try {
      const result = await this.getUserTweets(userId, limit, startTime, endTime);
      
      if (!result.success || !result.tweets) {
        return {
          success: false,
          error: result.error || 'Failed to fetch tweets',
        };
      }

      // Fetch analytics for each tweet
      const tweetsWithAnalytics = [];
      for (const tweet of result.tweets) {
        try {
          const analyticsResult = await this.getTweetAnalytics(tweet.id);
          
          if (analyticsResult.success && analyticsResult.analytics) {
            tweetsWithAnalytics.push({
              id: tweet.id,
              text: tweet.text || '',
              created_at: tweet.created_at,
              analytics: analyticsResult.analytics,
            });
          } else {
            // If analytics fetch fails, still include tweet with basic metrics from public_metrics
            const metrics = tweet.public_metrics || {};
            tweetsWithAnalytics.push({
              id: tweet.id,
              text: tweet.text || '',
              created_at: tweet.created_at,
              analytics: {
                likes: metrics.like_count || 0,
                retweets: metrics.retweet_count || 0,
                replies: metrics.reply_count || 0,
                quotes: metrics.quote_count || 0,
                impressions: metrics.impression_count,
                engagementRate: undefined,
              },
            });
          }

          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error fetching analytics for tweet ${tweet.id}:`, error);
          // Continue with next tweet even if one fails
        }
      }

      return {
        success: true,
        tweets: tweetsWithAnalytics,
        meta: result.meta,
      };
    } catch (error) {
      console.error('X API get tweets with analytics error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Helper method to determine MIME type from URL
   */
  private getMimeType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }
}

/**
 * Factory function to create an X API service instance
 */
export function createXApiService(credentials: XApiCredentials): XApiService {
  return new XApiService(credentials);
}
