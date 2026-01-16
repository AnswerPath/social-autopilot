import { supabaseAdmin } from '../supabase';
import { getXApiCredentials } from '../x-api-storage';
import { getUnifiedCredentials } from '../unified-credentials';
import { createXApiService, XApiService } from '../x-api-service';

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface PostAnalytics {
  id?: string;
  post_id: string | null; // null for tweets not linked to scheduled posts
  tweet_id: string;
  user_id: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions?: number;
  clicks?: number; // Clicks metric if available
  engagement_rate?: number;
  reach?: number;
  collected_at: Date;
  tweet_created_at?: Date; // Original tweet timestamp from X/Apify
}

export interface PostAnalyticsSummary {
  totalImpressions: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  averageEngagementRate: number;
  totalPosts: number;
}

export interface HistoricalAnalytics {
  postId: string;
  tweetId: string;
  content: string;
  postedAt: string;
  analytics: PostAnalytics[];
  latest: PostAnalytics | null;
  mediaUrls?: string[];
}

/**
 * Service for fetching, storing, and analyzing post analytics from X API
 */
export class PostAnalyticsService {
  /**
   * Calculate engagement rate from metrics
   * Based on average likes per post (not requiring impressions)
   */
  calculateEngagementRate(
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): number | null {
    // Engagement rate is now based on likes only (average likes per post)
    // This allows calculation even when impressions are not available
    return Number(likes.toFixed(4));
  }

  /**
   * Fetch analytics for a specific post from X API
   */
  async fetchPostAnalytics(
    userId: string,
    postId: string
  ): Promise<{ success: boolean; analytics?: PostAnalytics; error?: string; source?: 'apify' | 'x-api' }> {
    try {
      // Get the scheduled post to find the tweet_id
      const { data: post, error: postError } = await supabaseAdmin
        .from('scheduled_posts')
        .select('id, posted_tweet_id, user_id')
        .eq('id', postId)
        .eq('user_id', userId)
        .single();

      if (postError || !post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      if (!post.posted_tweet_id) {
        return {
          success: false,
          error: 'Post has not been published yet',
        };
      }

      // Check for Apify credentials first (preferred to avoid rate limits)
      console.log(`🔍 Checking for Apify credentials for user: ${userId}`);
      const { getApifyCredentials } = await import('@/lib/apify-storage');
      const { createApifyService } = await import('@/lib/apify-service');
      const apifyCredentialsResult = await getApifyCredentials(userId);

      if (apifyCredentialsResult.success && apifyCredentialsResult.credentials) {
        console.log(`✅ Apify credentials found. Using Apify for analytics to avoid X API rate limits.`);
        
        try {
          // Get X username (needed for Apify)
          let username: string | null = null;
          const { getXUsername } = await import('@/lib/apify-storage');
          const storedUsernameResult = await getXUsername(userId);
          
          if (storedUsernameResult.success && storedUsernameResult.username) {
            username = storedUsernameResult.username;
            console.log(`✅ Using stored X username for Apify: ${username}`);
          } else {
            // Try to get username from X API (minimal usage)
            console.log(`⚠️ No stored username found. Attempting to fetch from X API (may hit rate limits)...`);
            let xCredentialsResult = await getUnifiedCredentials(userId);
            if (!xCredentialsResult.success || !xCredentialsResult.credentials) {
              xCredentialsResult = await getXApiCredentials(userId);
            }
            
            if (xCredentialsResult.success && xCredentialsResult.credentials) {
              const xApiService = createXApiService(xCredentialsResult.credentials);
              const userInfo = await xApiService.testConnection();
              if (userInfo.success && userInfo.user) {
                username = userInfo.user.username;
                console.log(`✅ Got X username from X API for Apify: ${username}`);
                // Store it for future use
                const { storeXUsername } = await import('@/lib/apify-storage');
                await storeXUsername(userId, username);
              }
            }
          }

          if (!username) {
            return {
              success: false,
              error: 'Cannot use Apify for analytics: X username is required. Please enter your X username in Settings → Integrations.',
              source: 'apify' as const,
            };
          }

          // Use Apify to fetch post analytics
          const apifyService = createApifyService(apifyCredentialsResult.credentials);
          const apifyResult = await apifyService.getPostAnalytics(username, {
            maxPosts: 200,
          });

          if (apifyResult.success && apifyResult.posts && apifyResult.posts.length > 0) {
            // Find the post matching our tweet_id
            const postTweetId = String(post.posted_tweet_id);
            const apifyPost = apifyResult.posts.find((p: any) => {
              // Apify returns post IDs in various formats, try to match
              const apifyId = String(p.id || p.tweetId || '');
              return apifyId === postTweetId || apifyId.includes(postTweetId) || postTweetId.includes(apifyId);
            });

            if (apifyPost) {
              // Transform Apify post to PostAnalytics format
              const analytics: PostAnalytics = {
                post_id: postId,
                tweet_id: post.posted_tweet_id,
                user_id: userId,
                likes: apifyPost.likes || 0,
                retweets: apifyPost.retweets || 0,
                replies: apifyPost.replies || 0,
                quotes: apifyPost.quotes || 0,
                impressions: apifyPost.impressions || undefined,
                clicks: apifyPost.clicks || undefined,
                engagement_rate: this.calculateEngagementRate(
                  apifyPost.likes || 0,
                  apifyPost.retweets || 0,
                  apifyPost.replies || 0,
                  apifyPost.impressions
                ) || undefined,
                collected_at: new Date(),
                tweet_created_at: apifyPost.createdAt ? new Date(apifyPost.createdAt) : undefined,
              };

              return {
                success: true,
                analytics,
                source: 'apify' as const,
              };
            } else {
              return {
                success: false,
                error: `Tweet ${post.posted_tweet_id} not found in Apify results. It may be older than the fetch limit or not yet indexed.`,
                source: 'apify' as const,
              };
            }
          } else {
            return {
              success: false,
              error: apifyResult.error || 'Apify returned no posts',
              source: 'apify' as const,
            };
          }
        } catch (apifyError) {
          const errorDetails = apifyError instanceof Error ? apifyError.message : String(apifyError);
          console.error(`❌ Error using Apify for analytics:`, errorDetails);
          // Don't fall back to X API when Apify is configured
          return {
            success: false,
            error: `Apify analytics failed: ${errorDetails}. Please check your Apify account or try again later.`,
            source: 'apify' as const,
          };
        }
      }

      // Apify credentials not found - return error instead of using X API
      console.error(`❌ Apify credentials not found for user ${userId}. Analytics requires Apify credentials.`);
      return {
        success: false,
        error: 'Apify credentials not found. Please configure Apify credentials in Settings to fetch analytics. X API is only used for posting, not for analytics.',
        source: 'apify' as const,
      };
      
      // NOTE: X API fallback code has been removed. Analytics now requires Apify credentials.
      // X API is only used for posting tweets, not for fetching analytics.
    } catch (error) {
      console.error('Error fetching post analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch analytics for all published posts within a date range
   * Prefers Apify if available to avoid X API rate limits, falls back to X API
   */
  async fetchAllPostAnalytics(
    userId: string,
    dateRange?: AnalyticsTimeRange
  ): Promise<{ success: boolean; analytics?: PostAnalytics[]; error?: string; source?: 'apify' | 'x-api' }> {
    try {
      console.log(`🚀 fetchAllPostAnalytics called for user ${userId}`);
      
      // Check for Apify credentials first (preferred to avoid rate limits)
      console.log(`🔍 Checking for Apify credentials for user: ${userId}`);
      const { getApifyCredentials } = await import('@/lib/apify-storage');
      const { createApifyService } = await import('@/lib/apify-service');
      const apifyCredentialsResult = await getApifyCredentials(userId);
      
      // Log the result for debugging
      console.log(`📋 Apify credentials check result:`, {
        success: apifyCredentialsResult.success,
        hasCredentials: !!apifyCredentialsResult.credentials,
        error: apifyCredentialsResult.error,
        userId: userId,
      });
      
      if (apifyCredentialsResult.success && apifyCredentialsResult.credentials) {
        console.log(`✅ Apify credentials found. Using Apify for analytics to avoid X API rate limits.`);
        
        try {
          // First, try to get the stored X username (to avoid rate limit issues)
          let username: string | null = null;
          const { getXUsername } = await import('@/lib/apify-storage');
          const storedUsernameResult = await getXUsername(userId);
          
          if (storedUsernameResult.success && storedUsernameResult.username) {
            username = storedUsernameResult.username;
            console.log(`✅ Using stored X username for Apify: ${username}`);
          } else {
            // Fallback: Try to get username from X API (but warn about rate limits)
            console.log(`⚠️ No stored username found. Attempting to fetch from X API (may hit rate limits)...`);
            let xCredentialsResult = await getUnifiedCredentials(userId);
            if (!xCredentialsResult.success || !xCredentialsResult.credentials) {
              xCredentialsResult = await getXApiCredentials(userId);
            }
            
            if (xCredentialsResult.success && xCredentialsResult.credentials) {
              const xApiService = createXApiService(xCredentialsResult.credentials);
              const userInfo = await xApiService.testConnection();
              if (userInfo.success && userInfo.user) {
                username = userInfo.user.username || userInfo.user.name;
                console.log(`✅ Got X username from X API for Apify: ${username}`);
                // Optionally save it for future use
                const { storeXUsername } = await import('@/lib/apify-storage');
                await storeXUsername(userId, username);
                console.log(`💾 Saved username for future use to avoid rate limits`);
              } else {
                // Check if it's a rate limit error
                const errorMsg = userInfo.error || '';
                if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('Rate limit')) {
                  console.error(`❌ X API rate limit hit while trying to get username for Apify.`);
                  return {
                    success: false,
                    error: 'X API rate limit exceeded while trying to get username. Please enter your X username manually in Settings → Integrations to avoid this issue, or wait for the rate limit to reset.',
                    source: 'apify' as const,
                  };
                }
                console.log(`⚠️ Could not get X username from X API: ${errorMsg}`);
              }
            }
          }
          
          if (!username) {
            // Don't fall back to X API if we have Apify credentials - return an error instead
            console.error(`❌ Cannot use Apify without X username.`);
            return {
              success: false,
              error: 'Cannot use Apify for analytics: X username is required. Please enter your X username in Settings → Integrations to avoid rate limit issues, or ensure X API credentials are configured and not rate-limited.',
              source: 'apify' as const,
            };
          } else {
            // Use Apify to fetch post analytics
            const apifyService = createApifyService(apifyCredentialsResult.credentials);
            
            const apifyOptions: any = {
              maxPosts: 200, // Match X API limit
            };
            
            // Note: Apify actor doesn't support date filtering in input
            // We'll fetch all posts and filter by date range after fetching
            // if (dateRange) {
            //   apifyOptions.startDate = dateRange.startDate;
            //   apifyOptions.endDate = dateRange.endDate;
            // }
            
            console.log(`📡 Fetching post analytics from Apify for @${username}...`);
            console.log(`   Options:`, JSON.stringify(apifyOptions, null, 2));
            console.log(`   Date range (for post-filtering):`, dateRange ? {
              startDate: dateRange.startDate?.toISOString(),
              endDate: dateRange.endDate?.toISOString()
            } : 'none');
            
            const apifyResult = await apifyService.getPostAnalytics(username, {
              ...apifyOptions,
              // Pass date range for client-side filtering after fetch
              startDate: dateRange?.startDate,
              endDate: dateRange?.endDate,
            });
            
            if (apifyResult.success && apifyResult.posts && apifyResult.posts.length > 0) {
              console.log(`✅ Fetched ${apifyResult.posts.length} posts from Apify`);
              
              // Get scheduled posts to link analytics
              const { data: scheduledPosts } = await supabaseAdmin
                .from('scheduled_posts')
                .select('id, posted_tweet_id')
                .eq('user_id', userId)
                .not('posted_tweet_id', 'is', null);
              
              console.log(`📊 Found ${scheduledPosts?.length || 0} scheduled posts with tweet IDs for user ${userId}`);
              
              // Create a map of tweet_id -> post_id for quick lookup
              const tweetIdToPostId = new Map<string, string>();
              if (scheduledPosts) {
                scheduledPosts.forEach((post: any) => {
                  if (post.posted_tweet_id) {
                    const tweetIdStr = String(post.posted_tweet_id);
                    tweetIdToPostId.set(tweetIdStr, post.id);
                    // Also store without any whitespace/formatting
                    const cleanTweetId = tweetIdStr.trim();
                    if (cleanTweetId !== tweetIdStr) {
                      tweetIdToPostId.set(cleanTweetId, post.id);
                    }
                  }
                });
                console.log(`   Mapped ${tweetIdToPostId.size} tweet IDs to scheduled post UUIDs`);
                if (scheduledPosts.length > 0 && scheduledPosts.length <= 5) {
                  console.log(`   Sample mappings:`, Array.from(tweetIdToPostId.entries()).slice(0, 3).map(([tid, pid]) => ({
                    tweet_id: tid,
                    scheduled_post_id: pid,
                  })));
                }
              }
              
              // Transform Apify posts to PostAnalytics format
              const analytics: PostAnalytics[] = apifyResult.posts.map((post, index) => {
                // Try to find matching scheduled post by tweet ID
                // Extract tweet ID from URL if needed
                const tweetId = String(post.id || post.url.split('/').pop() || '').trim();
                
                // Try to find matching scheduled post - normalize tweet ID for comparison
                let postId: string | null = null;
                // Try exact match first
                postId = tweetIdToPostId.get(tweetId) || null;
                
                // If no exact match, try with different string representations
                if (!postId) {
                  // Try as number string (remove any non-numeric characters)
                  const numericId = tweetId.replace(/[^0-9]/g, '');
                  if (numericId && numericId !== tweetId) {
                    postId = tweetIdToPostId.get(numericId) || null;
                    if (postId) {
                      console.log(`   ✅ Post ${index + 1}: Matched tweet ID "${tweetId}" (normalized to "${numericId}") to scheduled post ${postId}`);
                    }
                  }
                } else {
                  console.log(`   ✅ Post ${index + 1}: Matched tweet ID "${tweetId}" to scheduled post ${postId}`);
                }
                
                if (!postId) {
                  console.log(`   ⚠️ Post ${index + 1}: Tweet ID "${tweetId}" not found in scheduled posts (will be stored as standalone tweet)`);
                }
                
                // Validate that postId is a UUID if it's not null
                if (postId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
                  console.error(`❌ Invalid UUID for scheduled_post_id: "${postId}" (tweet_id: ${tweetId}). Setting to null.`);
                  postId = null;
                }
                
                // Calculate engagement rate
                const engagementRate = this.calculateEngagementRate(
                  post.likes,
                  post.retweets,
                  post.replies,
                  post.impressions
                );
                
                // Extract tweet creation date from Apify post data
                // Apify returns createdAt as ISO string
                const tweetCreatedAt = post.createdAt ? new Date(post.createdAt) : undefined;
                
                return {
                  post_id: postId, // This should be UUID or null, never tweet ID
                  tweet_id: tweetId, // This is the tweet ID (large number as string)
                  user_id: userId,
                  likes: post.likes,
                  retweets: post.retweets,
                  replies: post.replies,
                  quotes: post.quotes || 0,
                  impressions: post.impressions,
                  clicks: post.clicks, // Include clicks if available from Apify
                  engagement_rate: engagementRate || undefined,
                  reach: undefined, // Apify doesn't provide reach data
                  collected_at: new Date(),
                  tweet_created_at: tweetCreatedAt, // Store the actual post date
                };
              });
              
              console.log(`✅ Transformed ${analytics.length} Apify posts to analytics format`);
              const linkedCount = analytics.filter(a => a.post_id).length;
              console.log(`   Linked to scheduled posts: ${linkedCount}/${analytics.length}`);
              
              return {
                success: true,
                analytics,
                source: 'apify' as const,
              };
            } else {
              const errorMsg = apifyResult.error || 'No posts found';
              console.log(`⚠️ Apify returned no posts or failed: ${errorMsg}`);
              console.log(`   Reason: ${errorMsg}`);
              
              // Check if Apify run succeeded but posts were filtered out
              // This can happen if:
              // 1. Author filter removed all items (username mismatch)
              // 2. Date range filter removed all items
              // 3. Items structure doesn't match expected format
              let detailedError = errorMsg;
              if (!apifyResult.error && apifyResult.posts && apifyResult.posts.length === 0) {
                detailedError = 'Apify run succeeded but no posts were returned. This might be due to filtering (author mismatch or date range) or data structure issues. Check server logs for details.';
              }
              
              // If Apify has credentials configured, don't fall back to X API - return the error instead
              // This prevents X API rate limit issues when Apify is configured
              console.log(`   Apify is configured but returned no data. Not falling back to X API to avoid rate limits.`);
              return {
                success: false,
                error: `Apify returned no posts: ${detailedError}. Please check your Apify account, verify the username matches, check date range settings, or try again later.`,
                source: 'apify' as const,
              };
            }
          }
        } catch (apifyError) {
          const errorDetails = apifyError instanceof Error ? apifyError.message : String(apifyError);
          console.error(`❌ Error using Apify for analytics:`, errorDetails);
          console.error(`   Error type: ${apifyError instanceof Error ? apifyError.constructor.name : typeof apifyError}`);
          if (apifyError instanceof Error && apifyError.stack) {
            console.error(`   Stack trace: ${apifyError.stack.substring(0, 200)}...`);
          }
          
          // When Apify credentials are configured, NEVER fall back to X API
          // This prevents X API rate limit issues and ensures Apify is used when configured
          console.error(`❌ Apify is configured but failed. Not falling back to X API to avoid rate limits.`);
          return {
            success: false,
            error: `Apify analytics failed: ${errorDetails}. Please check your Apify account, credentials, or try again later.`,
            source: 'apify' as const,
          };
        }
      } else {
        // Apify credentials not found - return error instead of falling back to X API
        // This ensures X API is never used for analytics, only for posting
        const errorMsg = apifyCredentialsResult.error || 'Unknown error';
        console.error(`❌ Apify credentials not found for user ${userId}. Analytics requires Apify credentials.`);
        console.error(`   Error details: ${errorMsg}`);
        console.error(`   Make sure Apify credentials are stored for userId: ${userId}`);
        console.error(`   Check Settings page to ensure credentials are saved for the correct user.`);
        return {
          success: false,
          error: `Apify credentials not found for your account. Please configure Apify credentials in Settings to fetch analytics. Error: ${errorMsg}. X API is only used for posting, not for analytics.`,
          source: 'apify' as const,
        };
      }
      
      // This code should never be reached if Apify credentials exist (we return early above)
      // Only reached if Apify credentials don't exist, but we now return an error instead
      // Keeping this as a safety net, but it should not execute
      console.error(`⚠️ Unexpected code path: Reached X API fallback when Apify should be required.`);
      return {
        success: false,
        error: 'Analytics service configuration error. Please configure Apify credentials in Settings.',
        source: 'apify' as const,
      };
      
      // NOTE: X API fallback code has been removed. Analytics now requires Apify credentials.
      // X API is only used for posting tweets, not for fetching analytics.
    } catch (error) {
      console.error('❌ Error fetching all post analytics:', error);
      console.error('   Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        dateRange,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        source: 'apify' as const, // Analytics uses Apify, not X API
      };
    }
  }

  /**
   * Store analytics data in the database
   */
  async storeAnalytics(
    analytics: PostAnalytics | PostAnalytics[]
  ): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const analyticsArray = Array.isArray(analytics) ? analytics : [analytics];
      
      console.log(`💾 Storing ${analyticsArray.length} analytics records...`);
      
      // Validate and transform analytics records
      const records = analyticsArray.map((a, index) => {
        // Validate that scheduled_post_id is either null or a valid UUID
        let scheduledPostId: string | null = null;
        if (a.post_id) {
          // Check if it's a valid UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(a.post_id)) {
            scheduledPostId = a.post_id;
          } else {
            // If it's not a UUID, it might be a tweet ID - log error and set to null
            console.error(`❌ Record ${index}: post_id "${a.post_id}" is not a valid UUID (looks like tweet ID). Setting scheduled_post_id to null.`);
            console.error(`   tweet_id: ${a.tweet_id}`);
            scheduledPostId = null;
          }
        }
        
        // Convert tweet_created_at to ISO string if it's a Date object
        let tweetCreatedAt: string | undefined = undefined;
        if (a.tweet_created_at) {
          if (a.tweet_created_at instanceof Date) {
            tweetCreatedAt = a.tweet_created_at.toISOString();
          } else if (typeof a.tweet_created_at === 'string') {
            // Already a string, validate it's a valid ISO string
            tweetCreatedAt = a.tweet_created_at;
          }
        }
        
        return {
          post_id: String(a.tweet_id),  // Map tweet_id to post_id (database column for tweet ID - TEXT type)
          scheduled_post_id: scheduledPostId,  // Map post_id (UUID) to scheduled_post_id (must be UUID or null)
          user_id: a.user_id,
          likes: a.likes,
          retweets: a.retweets,
          replies: a.replies,
          quotes: a.quotes,
          impressions: a.impressions,
          clicks: a.clicks, // Include clicks if available
          engagement_rate: a.engagement_rate,
          // Note: reach field removed - not in database schema
          collected_at: a.collected_at instanceof Date ? a.collected_at.toISOString() : a.collected_at,
          // Only include tweet_created_at if we have a valid value (don't send null/undefined)
          ...(tweetCreatedAt ? { tweet_created_at: tweetCreatedAt } : {}),
        };
      });

      // Log sample record to verify data
      if (records.length > 0) {
        console.log(`   Sample record:`, {
          post_id: records[0].post_id,  // This is the tweet ID (TEXT)
          scheduled_post_id: records[0].scheduled_post_id,  // This is the scheduled post UUID (UUID or null)
          isUuid: records[0].scheduled_post_id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(records[0].scheduled_post_id) : 'null',
          likes: records[0].likes,
          retweets: records[0].retweets,
          replies: records[0].replies,
          impressions: records[0].impressions,
        });
      }

      // Use upsert to avoid duplicates
      // Process all records together - both scheduled and standalone tweets use the same schema
      // The key difference is scheduled_post_id (UUID or null), but post_id (TEXT) is always the tweet ID
      console.log(`   Upserting ${records.length} analytics records (both scheduled and standalone)...`);
      
      // Ensure all records have the correct structure and types
      // CRITICAL: post_id is TEXT (tweet ID), scheduled_post_id is UUID (or null)
      const validatedRecords = records.map((r: any, index: number) => {
        // Extract tweet ID - this should already be in r.post_id from the first mapping
        const tweetId = String(r.post_id || r.tweet_id || '');
        
        // Validate tweet ID is not empty and is numeric (tweet IDs are large numbers)
        if (!tweetId || tweetId.trim() === '') {
          console.error(`   ❌ Record ${index}: Missing tweet ID, skipping`);
          return null;
        }
        
        // Build record with only the columns that exist in the database
        // Convert collected_at to ISO string if it's a Date object
        let collectedAt: string;
        if (r.collected_at instanceof Date) {
          collectedAt = r.collected_at.toISOString();
        } else if (typeof r.collected_at === 'string') {
          collectedAt = r.collected_at;
        } else {
          collectedAt = new Date().toISOString(); // Fallback to now
        }
        
        // Convert tweet_created_at to ISO string if provided, otherwise omit it
        // Only include tweet_created_at if we have a valid value (don't send null/undefined)
        // This prevents schema cache errors if the column doesn't exist or isn't recognized
        let tweetCreatedAt: string | undefined = undefined;
        if (r.tweet_created_at) {
          if (r.tweet_created_at instanceof Date) {
            tweetCreatedAt = r.tweet_created_at.toISOString();
          } else if (typeof r.tweet_created_at === 'string') {
            tweetCreatedAt = r.tweet_created_at;
          }
        }
        
        const record: any = {
          user_id: String(r.user_id),
          post_id: tweetId, // This is the tweet ID (TEXT type in database)
          tweet_id: tweetId, // Also set tweet_id column if it exists (same value as post_id)
          likes: Number(r.likes) || 0,
          retweets: Number(r.retweets) || 0,
          replies: Number(r.replies) || 0,
          quotes: Number(r.quotes) || 0,
          impressions: r.impressions !== undefined && r.impressions !== null ? Number(r.impressions) : null,
          clicks: r.clicks !== undefined && r.clicks !== null ? Number(r.clicks) : null, // Include clicks if available
          engagement_rate: r.engagement_rate !== undefined && r.engagement_rate !== null ? Number(r.engagement_rate) : null,
          collected_at: collectedAt,
        };
        
        // Only include tweet_created_at if we have a valid value
        // This prevents errors if Supabase's schema cache doesn't recognize the column
        if (tweetCreatedAt) {
          record.tweet_created_at = tweetCreatedAt;
        }
        
        // CRITICAL: Only include scheduled_post_id if it's a valid UUID
        // NEVER send tweet IDs to this UUID column
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (r.scheduled_post_id !== null && r.scheduled_post_id !== undefined) {
          const scheduledPostIdStr = String(r.scheduled_post_id);
          if (uuidRegex.test(scheduledPostIdStr)) {
            record.scheduled_post_id = scheduledPostIdStr;
          } else {
            // If it's not a UUID, it might be a tweet ID - this is an error
            console.error(`   ❌ Record ${index}: scheduled_post_id "${scheduledPostIdStr}" is not a valid UUID (looks like tweet ID). Setting to null.`);
            console.error(`      tweet_id: ${tweetId}`);
            record.scheduled_post_id = null;
          }
        } else {
          record.scheduled_post_id = null;
        }
        
        // Final safety check: ensure post_id is NOT a UUID (it should be a tweet ID/number)
        if (uuidRegex.test(tweetId)) {
          console.error(`   ❌ Record ${index}: post_id "${tweetId}" looks like a UUID but should be a tweet ID! This is a data mapping error.`);
          return null;
        }
        
        return record;
      }).filter((r: any) => r !== null); // Remove any null records
      
      // Log a sample of the validated records
      if (validatedRecords.length > 0) {
        console.log(`   Sample validated record:`, {
          user_id: validatedRecords[0].user_id,
          post_id: validatedRecords[0].post_id,
          scheduled_post_id: validatedRecords[0].scheduled_post_id,
          post_id_type: typeof validatedRecords[0].post_id,
          scheduled_post_id_type: typeof validatedRecords[0].scheduled_post_id,
        });
      }
      
      // Try to upsert with tweet_created_at first
      let { data, error } = await supabaseAdmin
        .from('post_analytics')
        .upsert(validatedRecords, {
          onConflict: 'user_id,post_id',
        })
        .select('id');
      
      // If error is due to tweet_created_at column not being recognized by schema cache,
      // retry without that column (backward compatibility)
      if (error && (
        error.message?.includes("tweet_created_at") || 
        error.message?.includes("Could not find") ||
        error.code === 'PGRST204'
      )) {
        console.warn(`   ⚠️ Schema cache issue with tweet_created_at column. Retrying without it...`);
        console.warn(`   Error: ${error.message}`);
        
        // Remove tweet_created_at from all records and retry
        const recordsWithoutTweetCreatedAt = validatedRecords.map((record: any) => {
          const { tweet_created_at, ...rest } = record;
          return rest;
        });
        
        const retryResult = await supabaseAdmin
          .from('post_analytics')
          .upsert(recordsWithoutTweetCreatedAt, {
            onConflict: 'user_id,post_id',
          })
          .select('id');
        
        if (retryResult.error) {
          console.error(`   ❌ Error upserting analytics records (retry failed):`, retryResult.error);
          console.error(`   Error details:`, {
            code: retryResult.error.code,
            message: retryResult.error.message,
            details: retryResult.error.details,
            hint: retryResult.error.hint,
          });
          // Log first record structure for debugging
          if (recordsWithoutTweetCreatedAt.length > 0) {
            console.error(`   First record structure (without tweet_created_at):`, JSON.stringify(recordsWithoutTweetCreatedAt[0], null, 2));
          }
          return {
            success: false,
            error: `Database error: ${retryResult.error.message}`,
          };
        }
        
        // Success on retry
        data = retryResult.data;
        console.warn(`   ✅ Successfully stored records without tweet_created_at (schema cache may need refresh)`);
      } else if (error) {
        console.error(`   ❌ Error upserting analytics records:`, error);
        console.error(`   Error details:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        // Log first record structure for debugging
        if (validatedRecords.length > 0) {
          console.error(`   First record structure:`, JSON.stringify(validatedRecords[0], null, 2));
        }
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
      
      console.log(`✅ Successfully stored ${data?.length || 0} analytics records`);
      return {
        success: true,
        count: data?.length || 0,
      };
    } catch (error) {
      console.error('Error storing analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get historical analytics for a user within a date range
   */
  async getHistoricalAnalytics(
    userId: string,
    dateRange?: AnalyticsTimeRange
  ): Promise<{ success: boolean; data?: HistoricalAnalytics[]; error?: string }> {
    try {
      // First, query analytics directly to see if we have any data at all
      console.log(`🔍 Step 1: Querying post_analytics table directly for user ${userId}...`);
      const { data: rawAnalytics, error: analyticsError } = await supabaseAdmin
        .from('post_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('collected_at', { ascending: false });

      if (analyticsError) {
        console.error(`❌ Database error fetching analytics for user ${userId}:`, analyticsError);
        return {
          success: false,
          error: `Database error: ${analyticsError.message}`,
        };
      }

      console.log(`📊 Found ${rawAnalytics?.length || 0} raw analytics records in database for user ${userId}`);
      if (rawAnalytics && rawAnalytics.length > 0) {
        const sample = rawAnalytics[0];
        console.log(`   Sample analytics record:`, {
          id: sample.id,
          post_id: sample.post_id,
          tweet_id: sample.tweet_id,
          likes: sample.likes,
          retweets: sample.retweets,
          replies: sample.replies,
          impressions: sample.impressions,
          collected_at: sample.collected_at,
        });
      }

      // Now fetch with join to get post details
      console.log(`🔍 Step 2: Fetching analytics with post details via join...`);
      
      // Fetch analytics data first
      // Note: The actual database schema uses 'tweet_id' for tweet IDs, not 'post_id'
      // 'post_id' is UUID (nullable) for backward compatibility
      let query = supabaseAdmin
        .from('post_analytics')
        .select(`
          id,
          post_id,
          tweet_id,
          scheduled_post_id,
          likes,
          retweets,
          replies,
          quotes,
          impressions,
          engagement_rate,
          collected_at,
          tweet_created_at
        `)
        .eq('user_id', userId)
        .order('collected_at', { ascending: false });

      let { data, error } = await query;

      if (error) {
        console.error(`❌ Database error fetching analytics for user ${userId}:`, error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }

      // If we have data, try to join with scheduled_posts
      // We'll match by tweet_id (X tweet ID) = posted_tweet_id in scheduled_posts
      if (data && data.length > 0) {
        // Use tweet_id if available, otherwise fall back to post_id (for backward compatibility)
        const tweetIds = data.map((row: any) => row.tweet_id || row.post_id).filter((id: any) => id);
        
        if (tweetIds.length > 0) {
          const { data: scheduledPosts } = await supabaseAdmin
            .from('scheduled_posts')
            .select('id, content, scheduled_at, status, media_urls, posted_tweet_id')
            .in('posted_tweet_id', tweetIds)
            .eq('user_id', userId);
          
          // Create a map of tweet_id -> scheduled_post
          const postMap = new Map();
          scheduledPosts?.forEach((post: any) => {
            if (post.posted_tweet_id) {
              postMap.set(String(post.posted_tweet_id), post);
            }
          });
          
          // Attach scheduled_posts data to analytics records
          data = data.map((row: any) => {
            const tweetId = row.tweet_id || row.post_id;
            return {
              ...row,
              scheduled_posts: postMap.get(String(tweetId)) || null,
              // Use scheduled_post_id from row if available, otherwise get from join
              scheduled_post_id: row.scheduled_post_id || postMap.get(String(tweetId))?.id || null,
            };
          });
        }
      }

      console.log(`📊 Query with join returned ${data?.length || 0} records from post_analytics table for user ${userId}`);
      
      // Check if join is working - count how many have post data
      if (data && data.length > 0) {
        const withPostData = data.filter((row: any) => row.scheduled_posts && row.scheduled_posts.id);
        const withoutPostData = data.filter((row: any) => !row.scheduled_posts || !row.scheduled_posts.id);
        console.log(`   Records with post data: ${withPostData.length}`);
        console.log(`   Records without post data: ${withoutPostData.length}`);
        
        if (withoutPostData.length > 0) {
          console.log(`   ⚠️ Warning: ${withoutPostData.length} analytics records don't have associated post data`);
          console.log(`   Sample tweet_ids without data: ${withoutPostData.slice(0, 5).map((r: any) => r.tweet_id || r.post_id).join(', ')}`);
        }
      }

      // Check if there are published posts that don't have analytics yet
      if ((!data || data.length === 0) && dateRange) {
        const { data: publishedPosts } = await supabaseAdmin
          .from('scheduled_posts')
          .select('id, scheduled_at, status, posted_tweet_id')
          .eq('user_id', userId)
          .eq('status', 'published')
          .not('posted_tweet_id', 'is', null)
          .gte('scheduled_at', dateRange.startDate.toISOString())
          .lte('scheduled_at', dateRange.endDate.toISOString());
        
        if (publishedPosts && publishedPosts.length > 0) {
          console.log(`⚠️ Found ${publishedPosts.length} published posts in date range but no analytics data. Analytics need to be fetched from X API first.`);
          console.log(`   Post IDs: ${publishedPosts.map(p => p.id).join(', ')}`);
        }
      }

      // Filter by date range if provided
      // For tweets linked to scheduled posts, use scheduled_at
      // For standalone tweets, use tweet_created_at (actual post date) if available, otherwise collected_at
      let filteredData = data;
      if (dateRange && filteredData) {
        // Normalize dates to start/end of day for proper comparison
        const startOfDay = new Date(dateRange.startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateRange.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const beforeFilter = filteredData.length;
        filteredData = filteredData.filter((row: any) => {
          const post = row.scheduled_posts;
          // If linked to a scheduled post, filter by scheduled_at
          if (post && post.scheduled_at) {
            const postDate = new Date(post.scheduled_at);
            return postDate >= startOfDay && postDate <= endOfDay;
          }
          // For standalone tweets (no scheduled_post), filter by tweet_created_at (actual post date)
          // Fall back to collected_at only if tweet_created_at is not available
          if (row.tweet_created_at) {
            const postDate = new Date(row.tweet_created_at);
            return postDate >= startOfDay && postDate <= endOfDay;
          }
          // Fallback to collected_at if tweet_created_at is not available (for backward compatibility)
          if (row.collected_at) {
            const collectedDate = new Date(row.collected_at);
            return collectedDate >= startOfDay && collectedDate <= endOfDay;
          }
          // If no date available, include it (shouldn't happen, but be safe)
          return true;
        });
        
        console.log(`📊 Filtered analytics: ${filteredData.length} records (from ${beforeFilter}) for date range ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
      }

      // Group by post_id (tweet ID) - use scheduled_post_id to check if linked to a scheduled post
      const postMap = new Map<string, HistoricalAnalytics>();
      
      // For standalone tweets, we need to fetch their text from X API
      // Get list of standalone tweet IDs (ones without scheduled_post_id)
      const standaloneTweetIds = filteredData
        ?.filter((row: any) => !row.scheduled_post_id)
        .map((row: any) => row.tweet_id || row.post_id) // Use tweet_id, fall back to post_id for backward compatibility
        .filter((id: any) => id) || []; // Filter out null/undefined values
      
      const tweetTextsMap = new Map<string, string>();
      
      // If we have standalone tweets, fetch their text from X API
      if (standaloneTweetIds.length > 0) {
        console.log(`🔍 Fetching text for ${standaloneTweetIds.length} standalone tweets from X API...`);
        try {
          // Get credentials for X API
          let credsResult = await getUnifiedCredentials(userId);
          if (!credsResult.success || !credsResult.credentials) {
            credsResult = await getXApiCredentials(userId);
          }
          
          if (credsResult.success && credsResult.credentials) {
            const xApiService = createXApiService(credsResult.credentials);
            const userInfo = await xApiService.testConnection();
            if (userInfo.success && userInfo.user) {
              const twitterUserId = userInfo.user.id;
              // Fetch recent tweets to get text for standalone ones
              const tweetsResult = await xApiService.getUserTweets(twitterUserId, 200);
              if (tweetsResult.success && tweetsResult.tweets) {
                tweetsResult.tweets.forEach((tweet: any) => {
                  if (tweet.text && standaloneTweetIds.includes(String(tweet.id))) {
                    tweetTextsMap.set(String(tweet.id), tweet.text);
                  }
                });
                console.log(`✅ Fetched text for ${tweetTextsMap.size} standalone tweets`);
              }
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Could not fetch tweet texts:`, error);
        }
      }
      
      filteredData?.forEach((row: any) => {
        // Use tweet_id as the key (actual database column for tweet IDs)
        // Fall back to post_id for backward compatibility
        const tweetId = row.tweet_id || row.post_id;
        const key = tweetId;
        const post = row.scheduled_posts;

        if (!key) {
          console.warn(`⚠️ Skipping row with no tweet_id or post_id:`, row.id);
          return;
        }

        if (!postMap.has(key)) {
          // Get content: from scheduled post if linked, or from X API if standalone
          let content = post?.content;
          if (!content && !row.scheduled_post_id) {
            // Standalone tweet - get text from X API fetch or use placeholder
            content = tweetTextsMap.get(tweetId) || `[Tweet ${tweetId.substring(0, 8)}...]`;
          }
          
          // Use tweet_created_at (actual post date) for standalone tweets if available
          // Fall back to scheduled_at for linked posts, or collected_at as last resort
          let postedAt: string;
          if (post?.scheduled_at) {
            postedAt = post.scheduled_at;
          } else if (row.tweet_created_at) {
            postedAt = typeof row.tweet_created_at === 'string' 
              ? row.tweet_created_at 
              : new Date(row.tweet_created_at).toISOString();
          } else {
            postedAt = typeof row.collected_at === 'string'
              ? row.collected_at
              : new Date(row.collected_at).toISOString(); // Last resort fallback
          }
          
          postMap.set(key, {
            postId: row.scheduled_post_id || tweetId, // Use scheduled_post_id if linked, otherwise tweet ID
            tweetId: tweetId, // tweet_id is the tweet ID
            content: content || `[Tweet ${tweetId}]`,
            postedAt: postedAt, // Use actual post date (tweet_created_at) when available
            analytics: [],
            latest: null,
            mediaUrls: post?.media_urls || undefined,
          });
        }

        const analytics: PostAnalytics = {
          id: row.id,
          post_id: row.scheduled_post_id || null, // Map scheduled_post_id back to post_id (UUID) for service interface
          tweet_id: tweetId, // tweet_id is the tweet ID in the database
          user_id: userId,
          likes: row.likes,
          retweets: row.retweets,
          replies: row.replies,
          quotes: row.quotes,
          impressions: row.impressions,
          engagement_rate: row.engagement_rate,
          // Note: reach field removed - not in database schema
          collected_at: new Date(row.collected_at),
        };

        const entry = postMap.get(key)!;
        entry.analytics.push(analytics);

        // Track latest analytics
        if (!entry.latest || analytics.collected_at > entry.latest.collected_at) {
          entry.latest = analytics;
        }
      });

      // Convert map to array and sort by latest collection time
      const result = Array.from(postMap.values()).sort((a, b) => {
        if (!a.latest || !b.latest) return 0;
        return b.latest.collected_at.getTime() - a.latest.collected_at.getTime();
      });

      console.log(`📊 getHistoricalAnalytics: Found ${result.length} posts with analytics for user ${userId}`);
      if (dateRange) {
        console.log(`   Date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`);
      }
      if (result.length > 0) {
        const totalImpressions = result.reduce((sum, r) => sum + (r.latest?.impressions || 0), 0);
        const totalLikes = result.reduce((sum, r) => sum + (r.latest?.likes || 0), 0);
        const totalRetweets = result.reduce((sum, r) => sum + (r.latest?.retweets || 0), 0);
        const totalReplies = result.reduce((sum, r) => sum + (r.latest?.replies || 0), 0);
        console.log(`   Summary: ${result.length} posts, ${totalImpressions} impressions, ${totalLikes} likes, ${totalRetweets} retweets, ${totalReplies} replies`);
        
        // Log details of first few posts to debug
        result.slice(0, 3).forEach((r, idx) => {
          if (r.latest) {
            console.log(`   Post ${idx + 1} (${r.postId}): likes=${r.latest.likes}, retweets=${r.latest.retweets}, replies=${r.latest.replies}, impressions=${r.latest.impressions || 'N/A'}`);
          }
        });
      } else {
        console.log(`   ⚠️ No analytics data found. This could mean:`);
        console.log(`      1. Analytics haven't been fetched from X API yet (click Refresh button)`);
        console.log(`      2. No posts were published in this date range`);
        console.log(`      3. Posts exist but don't have posted_tweet_id set`);
        
        // Additional diagnostic: check if there's ANY analytics data for this user
        const { data: anyAnalytics } = await supabaseAdmin
          .from('post_analytics')
          .select('id, post_id, likes, retweets, replies, impressions, collected_at')
          .eq('user_id', userId)
          .limit(5);
        
        if (anyAnalytics && anyAnalytics.length > 0) {
          console.log(`   🔍 Found ${anyAnalytics.length} analytics records for user (outside date range or filtered out):`);
          anyAnalytics.forEach(a => {
            console.log(`      - Post ${a.post_id}: likes=${a.likes}, retweets=${a.retweets}, replies=${a.replies}, impressions=${a.impressions || 'N/A'}, collected=${a.collected_at}`);
          });
        } else {
          console.log(`   🔍 No analytics records found in database at all for user ${userId}`);
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Error getting historical analytics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get analytics summary for a user within a date range
   */
  async getAnalyticsSummary(
    userId: string,
    dateRange?: AnalyticsTimeRange
  ): Promise<{ success: boolean; summary?: PostAnalyticsSummary; error?: string }> {
    try {
      // Get the latest analytics for each post
      const historicalResult = await this.getHistoricalAnalytics(userId, dateRange);
      
      if (!historicalResult.success || !historicalResult.data) {
        return {
          success: false,
          error: historicalResult.error || 'Failed to fetch historical analytics',
        };
      }

      // Calculate summary from latest analytics
      let totalImpressions = 0;
      let totalLikes = 0;
      let totalRetweets = 0;
      let totalReplies = 0;
      let totalEngagementRate = 0;
      let postsWithEngagementRate = 0;

      historicalResult.data.forEach(entry => {
        if (entry.latest) {
          totalLikes += entry.latest.likes;
          totalRetweets += entry.latest.retweets;
          totalReplies += entry.latest.replies;
          
          if (entry.latest.impressions) {
            totalImpressions += entry.latest.impressions;
          }
          
          if (entry.latest.engagement_rate !== null && entry.latest.engagement_rate !== undefined) {
            totalEngagementRate += entry.latest.engagement_rate;
            postsWithEngagementRate++;
          }
        }
      });

      const averageEngagementRate = postsWithEngagementRate > 0
        ? totalEngagementRate / postsWithEngagementRate
        : 0;

      return {
        success: true,
        summary: {
          totalImpressions,
          totalLikes,
          totalRetweets,
          totalReplies,
          averageEngagementRate: Number(averageEngagementRate.toFixed(4)),
          totalPosts: historicalResult.data.length,
        },
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

/**
 * Factory function to create a post analytics service
 */
export function createPostAnalyticsService(): PostAnalyticsService {
  return new PostAnalyticsService();
}
