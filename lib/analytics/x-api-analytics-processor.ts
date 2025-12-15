/**
 * X API Analytics Processor
 * ETL pipeline for fetching, processing, and storing X API analytics data
 */

import { XApiService, createXApiService, XApiCredentials } from '../x-api-service';
import { getUnifiedCredentials } from '../unified-credentials';
import { supabaseAdmin } from '../supabase';
import {
  transformTweetAnalytics,
  transformUserMetrics,
  transformAnalyticsResult,
  calculateEngagementRate,
  PostAnalytics,
  FollowerAnalytics,
} from './analytics-transformers';

export interface ProcessPostAnalyticsOptions {
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  syncAll?: boolean;
}

export interface ProcessPostAnalyticsResult {
  success: boolean;
  postsProcessed: number;
  postsSkipped: number;
  postsFailed: number;
  error?: string;
}

export interface ProcessFollowerAnalyticsResult {
  success: boolean;
  followerCount: number;
  followingCount: number;
  tweetCount: number;
  error?: string;
}

/**
 * X API Analytics Processor
 * Handles ETL process for X API analytics data
 */
export class XApiAnalyticsProcessor {
  private xApiService: XApiService | null = null;

  /**
   * Initialize the processor with user credentials
   */
  async initialize(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const credentialsResult = await getUnifiedCredentials(userId);
      
      if (!credentialsResult.success || !credentialsResult.credentials) {
        return {
          success: false,
          error: 'No X API credentials found',
        };
      }

      const creds = credentialsResult.credentials as XApiCredentials;
      
      // Validate credentials are not demo placeholders
      if (creds.apiKey?.includes('demo_') || creds.apiKeySecret?.includes('demo_') ||
          creds.accessToken?.includes('demo_') || creds.accessTokenSecret?.includes('demo_')) {
        return {
          success: false,
          error: 'Demo credentials cannot be used for analytics',
        };
      }

      this.xApiService = createXApiService(creds);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize processor',
      };
    }
  }

  /**
   * Process post analytics for a user
   * CRITICAL: Always fetches from X API user timeline, NOT from scheduled_posts table
   */
  async processPostAnalytics(
    userId: string,
    postIds?: string[],
    options?: ProcessPostAnalyticsOptions
  ): Promise<ProcessPostAnalyticsResult> {
    try {
      // Initialize if not already done
      if (!this.xApiService) {
        const initResult = await this.initialize(userId);
        if (!initResult.success) {
          return {
            success: false,
            postsProcessed: 0,
            postsSkipped: 0,
            postsFailed: 0,
            error: initResult.error,
          };
        }
      }

      let tweets: Array<{ id: string; text?: string; created_at?: string; analytics: any }> = [];
      let postsProcessed = 0;
      let postsSkipped = 0;
      let postsFailed = 0;

      // Get the X user ID from the authenticated user
      const meResult = await this.xApiService!.testConnection();
      if (!meResult.success || !meResult.user?.id) {
        return {
          success: false,
          postsProcessed: 0,
          postsSkipped: 0,
          postsFailed: 0,
          error: 'Failed to get authenticated user ID',
        };
      }
      const xUserId = meResult.user.id;

      if (postIds && postIds.length > 0) {
        // Fetch analytics for specific tweet IDs
        for (const postId of postIds) {
          try {
            const analyticsResult = await this.xApiService!.getTweetAnalytics(postId);
            if (analyticsResult.success && analyticsResult.analytics) {
              // Get tweet details directly from user timeline
              try {
                const tweetData = await this.xApiService!.getUserTweets(xUserId, 100);
                const tweet = tweetData.tweets?.find((t: any) => t.id === postId);
                
                tweets.push({
                  id: postId,
                  text: tweet?.text,
                  created_at: tweet?.created_at,
                  analytics: analyticsResult.analytics,
                });
              } catch (tweetError) {
                // If we can't get tweet details, still store analytics
                tweets.push({
                  id: postId,
                  text: undefined,
                  created_at: undefined,
                  analytics: analyticsResult.analytics,
                });
              }
            } else {
              postsFailed++;
            }
          } catch (error) {
            console.error(`Error processing post ${postId}:`, error);
            postsFailed++;
          }
        }
      } else {
        // Fetch ALL user tweets from X timeline (default behavior)
        const limit = options?.limit || (options?.syncAll ? 3200 : 100); // X API max is 3200 for pagination
        const startTime = options?.startTime;
        const endTime = options?.endTime;

        // Use getTweetsWithAnalytics to fetch all tweets with their analytics
        // CRITICAL: Fetch from X API user timeline, NOT from scheduled_posts
        const result = await this.xApiService!.getTweetsWithAnalytics(
          xUserId,
          limit,
          startTime,
          endTime
        );

        if (!result.success || !result.tweets) {
          return {
            success: false,
            postsProcessed: 0,
            postsSkipped: 0,
            postsFailed: 0,
            error: result.error || 'Failed to fetch tweets',
          };
        }

        tweets = result.tweets;
      }

      // Process and store each tweet's analytics
      for (const tweet of tweets) {
        try {
          const analytics = transformAnalyticsResult(
            tweet.analytics,
            tweet.text,
            tweet.created_at
          );

          // Try to find matching scheduled_post by post_id (X tweet ID)
          let scheduledPostId: string | null = null;
          if (tweet.id) {
            const { data: scheduledPost } = await supabaseAdmin
              .from('scheduled_posts')
              .select('id')
              .eq('posted_tweet_id', tweet.id)
              .eq('user_id', userId)
              .single();

            if (scheduledPost) {
              scheduledPostId = scheduledPost.id;
            }
          }

          // Upsert analytics data
          const { error: upsertError } = await supabaseAdmin
            .from('post_analytics')
            .upsert({
              user_id: userId,
              post_id: tweet.id,
              scheduled_post_id: scheduledPostId,
              tweet_text: analytics.tweetText,
              tweet_created_at: analytics.tweetCreatedAt?.toISOString(),
              impressions: analytics.impressions,
              likes: analytics.likes,
              retweets: analytics.retweets,
              replies: analytics.replies,
              quotes: analytics.quotes,
              clicks: analytics.clicks,
              engagement_rate: analytics.engagementRate,
              collected_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,post_id',
            });

          if (upsertError) {
            console.error(`Error storing analytics for post ${tweet.id}:`, upsertError);
            postsFailed++;
          } else {
            postsProcessed++;
          }
        } catch (error) {
          console.error(`Error processing tweet ${tweet.id}:`, error);
          postsFailed++;
        }
      }

      return {
        success: true,
        postsProcessed,
        postsSkipped,
        postsFailed,
      };
    } catch (error) {
      return {
        success: false,
        postsProcessed: 0,
        postsSkipped: 0,
        postsFailed: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process follower analytics for a user
   */
  async processFollowerAnalytics(userId: string): Promise<ProcessFollowerAnalyticsResult> {
    try {
      // Initialize if not already done
      if (!this.xApiService) {
        const initResult = await this.initialize(userId);
        if (!initResult.success) {
          return {
            success: false,
            followerCount: 0,
            followingCount: 0,
            tweetCount: 0,
            error: initResult.error,
          };
        }
      }

      // Get user analytics (for current authenticated user)
      const analyticsResult = await this.xApiService!.getUserAnalytics();
      
      if (!analyticsResult.success || !analyticsResult.analytics) {
        return {
          success: false,
          followerCount: 0,
          followingCount: 0,
          tweetCount: 0,
          error: analyticsResult.error || 'Failed to fetch user analytics',
        };
      }

      // Transform user analytics - analyticsResult.analytics already has the metrics
      const analytics = transformUserMetrics({ 
        public_metrics: {
          followers_count: analyticsResult.analytics.followerCount,
          following_count: analyticsResult.analytics.followingCount,
          tweet_count: analyticsResult.analytics.tweetCount,
        }
      });
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Upsert follower analytics for today
      const { error: upsertError } = await supabaseAdmin
        .from('follower_analytics')
        .upsert({
          user_id: userId,
          date: today,
          follower_count: analytics.followerCount,
          following_count: analytics.followingCount,
          tweet_count: analytics.tweetCount,
          collected_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date',
        });

      if (upsertError) {
        return {
          success: false,
          followerCount: analytics.followerCount,
          followingCount: analytics.followingCount,
          tweetCount: analytics.tweetCount,
          error: `Failed to store analytics: ${upsertError.message}`,
        };
      }

      return {
        success: true,
        followerCount: analytics.followerCount,
        followingCount: analytics.followingCount,
        tweetCount: analytics.tweetCount,
      };
    } catch (error) {
      return {
        success: false,
        followerCount: 0,
        followingCount: 0,
        tweetCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

/**
 * Factory function to create an analytics processor instance
 */
export function createXApiAnalyticsProcessor(): XApiAnalyticsProcessor {
  return new XApiAnalyticsProcessor();
}
