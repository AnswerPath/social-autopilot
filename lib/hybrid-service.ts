import { createApifyService, ApifyCredentials } from './apify-service';
import { createXApiService, XApiCredentials } from './x-api-service';
import { getApifyCredentials } from './apify-storage';
import { getXApiCredentials } from './x-api-storage';
import { createTokenManagementService } from './token-management';

export interface HybridPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  timestamp: string;
  source: 'x-api' | 'apify';
}

export interface HybridMentionsResult {
  success: boolean;
  mentions: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: string;
    url: string;
  }>;
  error?: string;
  source: 'apify';
}

export interface HybridAnalyticsResult {
  success: boolean;
  analytics: {
    followers: number;
    following: number;
    tweets: number;
    engagement: number;
    reach: number;
  };
  error?: string;
  source: 'apify' | 'x-api';
}

export class HybridService {
  private apifyService: any;
  private xApiService: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize the hybrid service with user credentials
   */
  async initialize(): Promise<{ success: boolean; error?: string; hasApify?: boolean; hasXApi?: boolean }> {
    try {
      let hasApify = false;
      let hasXApi = false;

      // Get Apify credentials
      const apifyResult = await getApifyCredentials(this.userId);
      if (apifyResult.success && apifyResult.credentials) {
        this.apifyService = createApifyService(apifyResult.credentials);
        hasApify = true;
      }

      // Get X API credentials
      const xApiResult = await getXApiCredentials(this.userId);
      if (xApiResult.success && xApiResult.credentials) {
        this.xApiService = createXApiService(xApiResult.credentials);
        hasXApi = true;
      }

      return {
        success: true,
        hasApify,
        hasXApi,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Post content using the best available service (X API preferred for posting)
   */
  async postContent(content: string, mediaUrls?: string[]): Promise<HybridPostResult> {
    try {
      // Validate tokens before posting
      const tokenService = createTokenManagementService(this.userId);
      const canPost = await tokenService.canPost();
      
      if (!canPost) {
        return {
          success: false,
          error: 'No valid posting credentials available. Please configure X API credentials.',
          timestamp: new Date().toISOString(),
          source: 'x-api',
        };
      }

      // Try X API first (preferred for posting)
      if (this.xApiService) {
        const result = await this.xApiService.postContent(content, mediaUrls);
        return {
          ...result,
          source: 'x-api' as const,
        };
      }

      // Fallback to Apify if X API is not available
      if (this.apifyService) {
        const result = await this.apifyService.postContent(content, mediaUrls);
        return {
          ...result,
          source: 'apify' as const,
        };
      }

      return {
        success: false,
        error: 'No posting service available. Please configure X API or Apify credentials.',
        timestamp: new Date().toISOString(),
        source: 'x-api',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        source: 'x-api',
      };
    }
  }

  /**
   * Reply to a tweet using X API
   */
  async replyToTweet(tweetId: string, content: string, mediaUrls?: string[]): Promise<HybridPostResult> {
    try {
      if (!this.xApiService) {
        return {
          success: false,
          error: 'X API credentials not configured. Please add your X API credentials.',
          timestamp: new Date().toISOString(),
          source: 'x-api',
        };
      }

      const result = await this.xApiService.replyToTweet(tweetId, content, mediaUrls);
      return {
        ...result,
        source: 'x-api' as const,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        source: 'x-api',
      };
    }
  }

  /**
   * Get mentions using Apify
   */
  async getMentions(username: string, limit: number = 50): Promise<HybridMentionsResult> {
    try {
      // Validate tokens before scraping
      const tokenService = createTokenManagementService(this.userId);
      const canScrape = await tokenService.canScrape();
      
      if (!canScrape) {
        return {
          success: false,
          mentions: [],
          error: 'No valid scraping credentials available. Please configure Apify API key.',
          source: 'apify',
        };
      }

      if (!this.apifyService) {
        return {
          success: false,
          mentions: [],
          error: 'Apify credentials not configured. Please add your Apify API key.',
          source: 'apify',
        };
      }

      const result = await this.apifyService.getMentions(username, limit);
      return {
        ...result,
        source: 'apify' as const,
      };
    } catch (error) {
      return {
        success: false,
        mentions: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'apify',
      };
    }
  }

  /**
   * Search X content by keywords using Apify
   */
  async searchXByKeywords(keywords: string, limit: number = 50): Promise<HybridMentionsResult> {
    try {
      if (!this.apifyService) {
        return {
          success: false,
          mentions: [],
          error: 'Apify credentials not configured. Please add your Apify API key.',
          source: 'apify',
        };
      }

      const result = await this.apifyService.searchXByKeywords(keywords, limit);
      return {
        ...result,
        source: 'apify' as const,
      };
    } catch (error) {
      return {
        success: false,
        mentions: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'apify',
      };
    }
  }

  /**
   * Get analytics data using the best available service
   * 
   * Note: For detailed post analytics and follower growth tracking,
   * use the XApiAnalyticsProcessor from @/lib/analytics/x-api-analytics-processor
   * which provides comprehensive ETL pipeline for X API analytics data.
   */
  async getAnalytics(username: string): Promise<HybridAnalyticsResult> {
    try {
      // Try X API first for analytics
      if (this.xApiService) {
        try {
          const profile = await this.xApiService.getUserProfile(username);
          if (profile.success && profile.profile) {
            const metrics = profile.profile.public_metrics || {};
            return {
              success: true,
              analytics: {
                followers: metrics.followers_count || 0,
                following: metrics.following_count || 0,
                tweets: metrics.tweet_count || 0,
                engagement: 0, // X API doesn't provide direct engagement metrics
                reach: 0, // X API doesn't provide direct reach metrics
              },
              source: 'x-api' as const,
            };
          }
        } catch (error) {
          console.log('X API analytics failed, trying Apify...');
        }
      }

      // Fallback to Apify
      if (this.apifyService) {
        const result = await this.apifyService.getAnalytics(username);
        return {
          ...result,
          source: 'apify' as const,
        };
      }

      return {
        success: false,
        analytics: {
          followers: 0,
          following: 0,
          tweets: 0,
          engagement: 0,
          reach: 0,
        },
        error: 'No analytics service available. Please configure X API or Apify credentials.',
        source: 'apify',
      };
    } catch (error) {
      return {
        success: false,
        analytics: {
          followers: 0,
          following: 0,
          tweets: 0,
          engagement: 0,
          reach: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'apify',
      };
    }
  }

  /**
   * Get user profile using the best available service
   */
  async getUserProfile(username: string): Promise<any> {
    try {
      // Try X API first
      if (this.xApiService) {
        const result = await this.xApiService.getUserProfile(username);
        if (result.success) {
          return {
            ...result,
            source: 'x-api',
          };
        }
      }

      // Fallback to Apify
      if (this.apifyService) {
        const result = await this.apifyService.getUserProfile(username);
        return {
          ...result,
          source: 'apify',
        };
      }

      return {
        success: false,
        error: 'No profile service available. Please configure X API or Apify credentials.',
        source: 'apify',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'apify',
      };
    }
  }

  /**
   * Get user's own tweets using X API
   */
  async getUserTweets(userId: string, limit: number = 50): Promise<any> {
    try {
      if (!this.xApiService) {
        return {
          success: false,
          tweets: [],
          error: 'X API credentials not configured. Please add your X API credentials.',
          source: 'x-api',
        };
      }

      const result = await this.xApiService.getUserTweets(userId, limit);
      return {
        ...result,
        source: 'x-api',
      };
    } catch (error) {
      return {
        success: false,
        tweets: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'x-api',
      };
    }
  }

  /**
   * Test all available connections
   */
  async testConnections(): Promise<{
    success: boolean;
    apify?: { success: boolean; error?: string; actorCount?: number };
    xApi?: { success: boolean; error?: string; user?: any };
  }> {
    const results: any = { success: true };

    // Test Apify connection
    if (this.apifyService) {
      try {
        const apifyTest = await this.apifyService.testConnection();
        if (apifyTest.success) {
          const actors = await this.apifyService.getAvailableActors();
          results.apify = { success: true, actorCount: actors.length };
        } else {
          results.apify = { success: false, error: apifyTest.error };
          results.success = false;
        }
      } catch (error) {
        results.apify = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        results.success = false;
      }
    }

    // Test X API connection
    if (this.xApiService) {
      try {
        const xApiTest = await this.xApiService.testConnection();
        results.xApi = xApiTest;
        if (!xApiTest.success) {
          results.success = false;
        }
      } catch (error) {
        results.xApi = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        results.success = false;
      }
    }

    return results;
  }
}

/**
 * Factory function to create a hybrid service instance
 */
export async function createHybridService(userId: string): Promise<HybridService> {
  const service = new HybridService(userId);
  await service.initialize();
  return service;
}
