import { TwitterApi } from 'twitter-api-v2';

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

  constructor(credentials: XApiCredentials) {
    this.credentials = credentials;
    this.client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiKeySecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessTokenSecret,
    });
  }

  /**
   * Post content using the official X API
   */
  async postContent(content: string, mediaUrls?: string[]): Promise<XPostResult> {
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
        ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } }),
      });

      return {
        success: true,
        postId: tweet.data.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('X API post content error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
      };
    }
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
  async getUserTweets(userId: string, limit: number = 50): Promise<any> {
    try {
      const tweets = await this.client.v2.userTimeline(userId, {
        max_results: limit,
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
      });

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
