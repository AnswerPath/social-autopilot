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
  async testConnection(): Promise<{ success: boolean; error?: string; user?: any; rateLimit?: any }> {
    try {
      // Test the connection by getting user info
      const user = await this.client.v2.me();
      
      // Extract rate limit info if available
      const rateLimitInfo = this.extractRateLimitInfo(user);
      
      return { 
        success: true, 
        user: user.data,
        rateLimit: rateLimitInfo,
      };
    } catch (error: any) {
      console.error('X API connection test failed:', error);
      
      // Extract rate limit info from error if available
      const rateLimitInfo = this.extractRateLimitInfoFromError(error);
      
      // Extract more detailed error information
      let errorMessage = 'Unknown error occurred';
      let errorCode = null;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error?.data) {
        // Twitter API v2 error format
        errorMessage = error.data.detail || error.data.title || error.message || 'Unknown error';
        errorCode = error.data.type || error.status;
      } else if (error?.response) {
        // HTTP error response
        errorMessage = error.response.data?.detail || error.response.data?.title || error.message || 'Unknown error';
        errorCode = error.response.status;
      }
      
      // Provide more helpful error messages
      if (errorCode === 401 || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid')) {
        errorMessage = 'Invalid X API credentials. Please check your API keys, secrets, access token, and access token secret in Settings.';
      } else if (errorCode === 403 || errorMessage.includes('Forbidden')) {
        errorMessage = 'X API access forbidden. Your credentials may not have the required permissions.';
      } else if (errorCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
        if (rateLimitInfo) {
          const resetTime = new Date(rateLimitInfo.resetAt * 1000);
          const minutesUntilReset = Math.ceil((rateLimitInfo.resetAt * 1000 - Date.now()) / 1000 / 60);
          errorMessage = `X API rate limit exceeded for user lookup endpoint. ${rateLimitInfo.remaining || 0} requests remaining. Reset in ${minutesUntilReset} minutes (${resetTime.toLocaleTimeString()}).`;
        } else {
          errorMessage = 'X API rate limit exceeded. Please wait a few minutes and try again.';
        }
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Network error connecting to X API. Please check your internet connection.';
      }
      
      return {
        success: false,
        error: errorMessage,
        rateLimit: rateLimitInfo,
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
  async getUserTweets(userId: string, limit: number = 50): Promise<any> {
    try {
      const tweets = await this.client.v2.userTimeline(userId, {
        max_results: limit,
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      });

      // Extract rate limit info from response headers if available
      const rateLimitInfo = this.extractRateLimitInfo(tweets);

      return {
        success: true,
        tweets: tweets.data.data || [],
        meta: tweets.data.meta,
        rateLimit: rateLimitInfo,
      };
    } catch (error: any) {
      console.error('X API get user tweets error:', error);
      
      // Extract rate limit info from error if available
      const rateLimitInfo = this.extractRateLimitInfoFromError(error);
      
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Enhance error message for rate limits
      if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
        if (rateLimitInfo) {
          const resetTime = new Date(rateLimitInfo.resetAt * 1000);
          const minutesUntilReset = Math.ceil((rateLimitInfo.resetAt * 1000 - Date.now()) / 1000 / 60);
          errorMessage = `X API rate limit exceeded for user timeline endpoint. Free tier allows 15 requests per 15 minutes. ${rateLimitInfo.remaining || 0} requests remaining. Reset in ${minutesUntilReset} minutes (${resetTime.toLocaleTimeString()}).`;
        } else {
          errorMessage = 'X API rate limit exceeded for user timeline endpoint. Free tier allows 15 requests per 15 minutes. Please wait 15 minutes before trying again.';
        }
      }
      
      return {
        success: false,
        tweets: [],
        error: errorMessage,
        rateLimit: rateLimitInfo,
      };
    }
  }

  /**
   * Extract rate limit information from API response
   */
  private extractRateLimitInfo(response: any): { limit: number; remaining: number; resetAt: number } | null {
    try {
      // twitter-api-v2 library stores rate limit info in response.rateLimit
      if (response.rateLimit) {
        return {
          limit: response.rateLimit.limit || 0,
          remaining: response.rateLimit.remaining || 0,
          resetAt: response.rateLimit.reset || Math.floor(Date.now() / 1000) + 900, // Default to 15 min from now
        };
      }
      
      // Try to extract from headers if available
      if (response.headers) {
        const limit = parseInt(response.headers.get('x-rate-limit-limit') || '0');
        const remaining = parseInt(response.headers.get('x-rate-limit-remaining') || '0');
        const reset = parseInt(response.headers.get('x-rate-limit-reset') || '0');
        
        if (limit > 0) {
          return { limit, remaining, resetAt: reset };
        }
      }
    } catch (e) {
      // Ignore extraction errors
    }
    
    return null;
  }

  /**
   * Extract rate limit information from error response
   */
  private extractRateLimitInfoFromError(error: any): { limit: number; remaining: number; resetAt: number } | null {
    try {
      // Check if error has rate limit info
      if (error.rateLimit) {
        return {
          limit: error.rateLimit.limit || 0,
          remaining: error.rateLimit.remaining || 0,
          resetAt: error.rateLimit.reset || Math.floor(Date.now() / 1000) + 900,
        };
      }
      
      // Check error response headers
      if (error.response?.headers) {
        const headers = error.response.headers;
        const limit = parseInt(headers.get('x-rate-limit-limit') || '0');
        const remaining = parseInt(headers.get('x-rate-limit-remaining') || '0');
        const reset = parseInt(headers.get('x-rate-limit-reset') || '0');
        
        if (limit > 0) {
          return { limit, remaining, resetAt: reset };
        }
      }
    } catch (e) {
      // Ignore extraction errors
    }
    
    return null;
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
