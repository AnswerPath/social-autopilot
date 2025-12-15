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
  engagement_rate?: number;
  reach?: number;
  collected_at: Date;
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
   */
  calculateEngagementRate(
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): number | null {
    if (!impressions || impressions === 0) {
      return null;
    }
    const totalEngagement = likes + retweets + replies;
    return Number(((totalEngagement / impressions) * 100).toFixed(4));
  }

  /**
   * Fetch analytics for a specific post from X API
   */
  async fetchPostAnalytics(
    userId: string,
    postId: string
  ): Promise<{ success: boolean; analytics?: PostAnalytics; error?: string }> {
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

      // Get X API credentials (try unified credentials first for migration support)
      console.log(`🔍 Fetching X API credentials for user: ${userId}`);
      let credentialsResult = await getUnifiedCredentials(userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        console.log(`⚠️ Unified credentials not found, trying direct X API credentials for user: ${userId}`);
        // Fallback to direct X API credentials
        credentialsResult = await getXApiCredentials(userId);
        if (!credentialsResult.success || !credentialsResult.credentials) {
          const errorMsg = credentialsResult.error || 'No credentials found';
          console.error(`❌ X API credentials not found for user ${userId}:`, errorMsg);
          return {
            success: false,
            error: 'X API credentials not found. Please configure your X API credentials in Settings.',
          };
        }
      }
      
      console.log(`✅ X API credentials retrieved successfully for user: ${userId}`);

      // Ensure userId is set on credentials
      const credentials = credentialsResult.credentials;
      if (!credentials.userId) {
        credentials.userId = userId;
      }

      // Create X API service and fetch tweet data
      const xApiService = createXApiService(credentials);
      
      // First, get the authenticated user's X/Twitter ID
      const userInfo = await xApiService.testConnection();
      if (!userInfo.success || !userInfo.user) {
        return {
          success: false,
          error: 'Failed to authenticate with X API',
        };
      }
      
      const twitterUserId = userInfo.user.id;
      
      // Get user's own tweets to find the specific tweet
      // Note: X API doesn't have a direct endpoint to get a single tweet by ID for analytics
      // We'll need to fetch the user's timeline and find the matching tweet
      const tweetsResult = await xApiService.getUserTweets(twitterUserId, 100);
      
      if (!tweetsResult.success || !tweetsResult.tweets) {
        return {
          success: false,
          error: 'Failed to fetch tweets from X API',
        };
      }

      // Normalize tweet ID to string for comparison
      const postTweetId = String(post.posted_tweet_id);
      // Find the tweet matching our post (normalize IDs to strings)
      const tweet = tweetsResult.tweets.find((t: any) => String(t.id) === postTweetId);
      
      if (!tweet) {
        return {
          success: false,
          error: 'Tweet not found in user timeline. It may have been deleted or is older than the API limit.',
        };
      }

      // Extract metrics from tweet
      const metrics = tweet.public_metrics || {};
      console.log(`📊 Processing single tweet ${post.posted_tweet_id} for post ${postId}:`, {
        hasMetrics: !!metrics,
        metricsKeys: metrics ? Object.keys(metrics) : [],
        fullMetrics: metrics,
      });
      
      // X API v2 uses different field names - check both
      const impressions = metrics.impression_count ?? metrics.impressions ?? null;
      const likes = metrics.like_count ?? metrics.likes ?? 0;
      const retweets = metrics.retweet_count ?? metrics.retweets ?? 0;
      const replies = metrics.reply_count ?? metrics.replies ?? 0;
      const quotes = metrics.quote_count ?? metrics.quotes ?? 0;
      
      console.log(`   Extracted values: likes=${likes}, retweets=${retweets}, replies=${replies}, quotes=${quotes}, impressions=${impressions}`);
      
      const engagementRate = this.calculateEngagementRate(
        likes,
        retweets,
        replies,
        impressions || undefined
      );

      const analytics: PostAnalytics = {
        post_id: postId,
        tweet_id: post.posted_tweet_id,
        user_id: userId,
        likes,
        retweets,
        replies,
        quotes,
        impressions: impressions || undefined,
        engagement_rate: engagementRate || undefined,
        reach: null, // X API doesn't provide reach directly
        collected_at: new Date(),
      };
      
      console.log(`   Final analytics record:`, analytics);

      return {
        success: true,
        analytics,
      };
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
   */
  async fetchAllPostAnalytics(
    userId: string,
    dateRange?: AnalyticsTimeRange
  ): Promise<{ success: boolean; analytics?: PostAnalytics[]; error?: string }> {
    try {
      console.log(`🚀 fetchAllPostAnalytics called for user ${userId}`);
      // Get X API credentials (try unified credentials first for migration support)
      console.log(`🔍 Fetching X API credentials for user: ${userId}`);
      let credentialsResult = await getUnifiedCredentials(userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        console.log(`⚠️ Unified credentials not found, trying direct X API credentials for user: ${userId}`);
        // Fallback to direct X API credentials
        credentialsResult = await getXApiCredentials(userId);
        if (!credentialsResult.success || !credentialsResult.credentials) {
          const errorMsg = credentialsResult.error || 'No credentials found';
          console.error(`❌ X API credentials not found for user ${userId}:`, errorMsg);
          return {
            success: false,
            error: 'X API credentials not found. Please configure your X API credentials in Settings.',
          };
        }
      }
      
      console.log(`✅ X API credentials retrieved successfully for user: ${userId}`);

      // Ensure userId is set on credentials
      const credentials = credentialsResult.credentials;
      if (!credentials.userId) {
        credentials.userId = userId;
      }

      // First, check what posts exist for this user
      console.log(`🔍 Checking scheduled_posts table for user ${userId}...`);
      const { data: allUserPosts, error: allPostsError } = await supabaseAdmin
        .from('scheduled_posts')
        .select('id, status, posted_tweet_id, scheduled_at, content')
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: false })
        .limit(20);
      
      if (allPostsError) {
        console.error(`❌ Error checking all posts: ${allPostsError.message}`);
      } else {
        console.log(`📊 Found ${allUserPosts?.length || 0} total posts for user ${userId}`);
        if (allUserPosts && allUserPosts.length > 0) {
          const statusCounts = allUserPosts.reduce((acc: any, p: any) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {});
          console.log(`   Status breakdown:`, statusCounts);
          const published = allUserPosts.filter((p: any) => p.status === 'published');
          const withTweetId = published.filter((p: any) => p.posted_tweet_id);
          console.log(`   Published posts: ${published.length}, with tweet_id: ${withTweetId.length}`);
          if (withTweetId.length > 0) {
            console.log(`   Published posts with tweet IDs:`, withTweetId.map((p: any) => ({
              id: p.id,
              tweet_id: p.posted_tweet_id,
              scheduled_at: p.scheduled_at,
            })));
          }
        }
      }

      // Create X API service
      const xApiService = createXApiService(credentials);
      
      // First, get the authenticated user's X/Twitter ID
      console.log(`🔍 Getting authenticated user's X/Twitter ID...`);
      const userInfo = await xApiService.testConnection();
      if (!userInfo.success || !userInfo.user) {
        console.error(`❌ Failed to get authenticated user info: ${userInfo.error || 'Unknown error'}`);
        return {
          success: false,
          error: 'Failed to authenticate with X API',
        };
      }
      
      const twitterUserId = userInfo.user.id;
      console.log(`✅ Authenticated as X/Twitter user ID: ${twitterUserId}`);
      
      console.log(`📡 Fetching ALL tweets from X API for user ${twitterUserId}...`);
      // Fetch ALL user's tweets (not just ones linked to scheduled posts)
      const maxTweets = 200;
      const tweetsResult = await xApiService.getUserTweets(twitterUserId, maxTweets);
      
      if (!tweetsResult.success || !tweetsResult.tweets) {
        console.error(`❌ Failed to fetch tweets from X API: ${tweetsResult.error || 'Unknown error'}`);
        return {
          success: false,
          error: 'Failed to fetch tweets from X API',
        };
      }

      console.log(`✅ Fetched ${tweetsResult.tweets.length} tweets from X API`);
      if (tweetsResult.tweets.length > 0) {
        const firstTweet = tweetsResult.tweets[0];
        console.log(`   Sample tweet structure:`, {
          id: firstTweet.id,
          text: firstTweet.text?.substring(0, 50),
          created_at: firstTweet.created_at,
          hasPublicMetrics: !!firstTweet.public_metrics,
          publicMetrics: firstTweet.public_metrics,
        });
        console.log(`   Tweet IDs from API: ${tweetsResult.tweets.slice(0, 5).map((t: any) => String(t.id)).join(', ')}${tweetsResult.tweets.length > 5 ? '...' : ''}`);
      }

      // Get scheduled posts to link tweets if they exist (optional - for linking)
      const { data: scheduledPosts } = await supabaseAdmin
        .from('scheduled_posts')
        .select('id, posted_tweet_id, scheduled_at, content')
        .eq('user_id', userId)
        .not('posted_tweet_id', 'is', null);

      // Create a map of tweet_id to scheduled post (for linking if available)
      const tweetToPostMap = new Map<string, { id: string; scheduled_at: string; content: string }>();
      // Also create a map of tweet_id to tweet text for standalone tweets
      const tweetTextMap = new Map<string, string>();
      
      if (scheduledPosts) {
        scheduledPosts.forEach((post: any) => {
          if (post.posted_tweet_id) {
            tweetToPostMap.set(String(post.posted_tweet_id), {
              id: post.id,
              scheduled_at: post.scheduled_at,
              content: post.content || '',
            });
          }
        });
        console.log(`📊 Found ${scheduledPosts.length} scheduled posts to potentially link with tweets`);
      }
      
      // Store tweet text for standalone tweets
      tweetsResult.tweets.forEach((tweet: any) => {
        if (tweet.text) {
          tweetTextMap.set(String(tweet.id), tweet.text);
        }
      });

      // Process ALL tweets and build analytics (not just ones linked to scheduled posts)
      const analytics: PostAnalytics[] = [];
      const now = new Date();
      let processedCount = 0;
      let filteredByDate = 0;
      
      // Store tweet texts for later use in getHistoricalAnalytics
      // We'll need to pass this or store it somehow - for now, we'll fetch it when needed

      for (const tweet of tweetsResult.tweets) {
        const tweetId = String(tweet.id);
        const tweetCreatedAt = tweet.created_at ? new Date(tweet.created_at) : null;
        
        // Filter by date range if provided
        if (dateRange && tweetCreatedAt) {
          const startOfDay = new Date(dateRange.startDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(dateRange.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          if (tweetCreatedAt < startOfDay || tweetCreatedAt > endOfDay) {
            filteredByDate++;
            continue;
          }
        }

        processedCount++;

        // Check if this tweet is linked to a scheduled post (optional)
        const linkedPost = tweetToPostMap.get(tweetId);
        
        // Store tweet text for standalone tweets
        if (tweet.text && !linkedPost) {
          tweetTextMap.set(tweetId, tweet.text);
        }

        const metrics = tweet.public_metrics || {};
        
        // X API v2 uses different field names - check both
        const impressions = metrics.impression_count ?? metrics.impressions ?? null;
        const likes = metrics.like_count ?? metrics.likes ?? 0;
        const retweets = metrics.retweet_count ?? metrics.retweets ?? 0;
        const replies = metrics.reply_count ?? metrics.replies ?? 0;
        const quotes = metrics.quote_count ?? metrics.quotes ?? 0;
        
        const engagementRate = this.calculateEngagementRate(
          likes,
          retweets,
          replies,
          impressions || undefined
        );

        const analyticsRecord: PostAnalytics = {
          post_id: linkedPost?.id || null, // null if not linked to a scheduled post
          tweet_id: tweetId,
          user_id: userId,
          likes,
          retweets,
          replies,
          quotes,
          impressions: impressions || undefined,
          engagement_rate: engagementRate || undefined,
          reach: null,
          collected_at: now,
        };
        
        analytics.push(analyticsRecord);
      }

      console.log(`📊 Processed ${processedCount} tweets (${filteredByDate} filtered out by date range)`);
      console.log(`   Created ${analytics.length} analytics records`);
      if (analytics.length > 0) {
        const linkedCount = analytics.filter(a => a.post_id).length;
        const unlinkedCount = analytics.filter(a => !a.post_id).length;
        console.log(`   Linked to scheduled posts: ${linkedCount}, Standalone tweets: ${unlinkedCount}`);
        const totalImpressions = analytics.reduce((sum, a) => sum + (a.impressions || 0), 0);
        const totalLikes = analytics.reduce((sum, a) => sum + a.likes, 0);
        console.log(`   Summary: ${totalImpressions} impressions, ${totalLikes} likes`);
      }


      console.log(`✅ fetchAllPostAnalytics completed successfully with ${analytics.length} analytics records`);
      return {
        success: true,
        analytics,
      };
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
      
      const records = analyticsArray.map(a => ({
        post_id: a.post_id,
        tweet_id: a.tweet_id,
        user_id: a.user_id,
        likes: a.likes,
        retweets: a.retweets,
        replies: a.replies,
        quotes: a.quotes,
        impressions: a.impressions,
        engagement_rate: a.engagement_rate,
        reach: a.reach,
        collected_at: a.collected_at.toISOString(),
      }));

      // Log sample record to verify data
      if (records.length > 0) {
        console.log(`   Sample record:`, {
          post_id: records[0].post_id,
          tweet_id: records[0].tweet_id,
          likes: records[0].likes,
          retweets: records[0].retweets,
          replies: records[0].replies,
          impressions: records[0].impressions,
        });
      }

      // Use upsert to avoid duplicates
      // Split records into those with post_id and those without
      const withPostId = records.filter((r: any) => r.post_id);
      const withoutPostId = records.filter((r: any) => !r.post_id);
      
      let allData: any[] = [];
      let hasError = false;
      let lastError: any = null;
      
      // Upsert records with post_id using the existing constraint
      if (withPostId.length > 0) {
        const { data: data1, error: error1 } = await supabaseAdmin
          .from('post_analytics')
          .upsert(withPostId, {
            onConflict: 'post_id,collected_at',
          })
          .select('id');
        
        if (error1) {
          console.error(`   ❌ Error upserting records with post_id:`, error1);
          hasError = true;
          lastError = error1;
        } else {
          allData = [...allData, ...(data1 || [])];
        }
      }
      
      // For records without post_id, we need to handle them differently
      // Since the constraint is on (post_id, collected_at), we can't use it for null post_id
      // We'll check for existing records manually and insert/update accordingly
      if (withoutPostId.length > 0) {
        console.log(`   Processing ${withoutPostId.length} standalone tweets (no post_id)...`);
        
        // Check which ones already exist
        const tweetIds = withoutPostId.map((r: any) => r.tweet_id);
        const collectedAt = withoutPostId[0].collected_at; // All should have same collected_at
        
        const { data: existing } = await supabaseAdmin
          .from('post_analytics')
          .select('id, tweet_id')
          .in('tweet_id', tweetIds)
          .is('post_id', null)
          .eq('collected_at', collectedAt);
        
        const existingTweetIds = new Set((existing || []).map((e: any) => e.tweet_id));
        const toInsert = withoutPostId.filter((r: any) => !existingTweetIds.has(r.tweet_id));
        const toUpdate = withoutPostId.filter((r: any) => existingTweetIds.has(r.tweet_id));
        
        // Insert new ones
        if (toInsert.length > 0) {
          const { data: inserted, error: insertError } = await supabaseAdmin
            .from('post_analytics')
            .insert(toInsert)
            .select('id');
          
          if (insertError) {
            console.error(`   ❌ Error inserting standalone tweets:`, insertError);
            hasError = true;
            lastError = insertError;
          } else {
            allData = [...allData, ...(inserted || [])];
            console.log(`   ✅ Inserted ${inserted?.length || 0} new standalone tweet analytics`);
          }
        }
        
        // Update existing ones (by deleting and re-inserting, or using update)
        if (toUpdate.length > 0) {
          // Delete existing and re-insert (simpler than complex update)
          const tweetIdsToUpdate = toUpdate.map((r: any) => r.tweet_id);
          await supabaseAdmin
            .from('post_analytics')
            .delete()
            .in('tweet_id', tweetIdsToUpdate)
            .is('post_id', null)
            .eq('collected_at', collectedAt);
          
          const { data: updated, error: updateError } = await supabaseAdmin
            .from('post_analytics')
            .insert(toUpdate)
            .select('id');
          
          if (updateError) {
            console.error(`   ❌ Error updating standalone tweets:`, updateError);
            hasError = true;
            lastError = updateError;
          } else {
            allData = [...allData, ...(updated || [])];
            console.log(`   ✅ Updated ${updated?.length || 0} existing standalone tweet analytics`);
          }
        }
      }
      
      const data = allData;
      const error = hasError ? lastError : null;

      if (error) {
        console.error('❌ Error storing analytics:', error);
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
      let query = supabaseAdmin
        .from('post_analytics')
        .select(`
          id,
          post_id,
          tweet_id,
          likes,
          retweets,
          replies,
          quotes,
          impressions,
          engagement_rate,
          reach,
          collected_at,
          scheduled_posts(id, content, scheduled_at, status, media_urls)
        `)
        .eq('user_id', userId)
        .order('collected_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error(`❌ Database error fetching analytics with join for user ${userId}:`, error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
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
          console.log(`   Sample post_ids without data: ${withoutPostData.slice(0, 5).map((r: any) => r.post_id).join(', ')}`);
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
      // For standalone tweets, we can't filter by date (X API doesn't return created_at in analytics)
      // So we'll include all standalone tweets if date range is provided
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
          // For standalone tweets (no scheduled_post), include them all
          // (We can't filter by tweet creation date from analytics data alone)
          return true;
        });
        
        console.log(`📊 Filtered analytics: ${filteredData.length} records (from ${beforeFilter}) for date range ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
      }

      // Group by tweet_id (or post_id if linked to a scheduled post)
      const postMap = new Map<string, HistoricalAnalytics>();
      
      // For standalone tweets, we need to fetch their text from X API
      // Get list of standalone tweet IDs (ones without post_id)
      const standaloneTweetIds = filteredData
        ?.filter((row: any) => !row.post_id)
        .map((row: any) => row.tweet_id) || [];
      
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
        // Use tweet_id as the key since we now support standalone tweets
        // For tweets linked to posts, we can still group by post_id, but for standalone tweets use tweet_id
        const key = row.post_id || row.tweet_id;
        const post = row.scheduled_posts;

        if (!postMap.has(key)) {
          // Get content: from scheduled post if linked, or from X API if standalone
          let content = post?.content;
          if (!content && !row.post_id) {
            // Standalone tweet - get text from X API fetch or use placeholder
            content = tweetTextsMap.get(row.tweet_id) || `[Tweet ${row.tweet_id.substring(0, 8)}...]`;
          }
          
          postMap.set(key, {
            postId: row.post_id || row.tweet_id, // Use tweet_id if no post_id
            tweetId: row.tweet_id,
            content: content || `[Tweet ${row.tweet_id}]`,
            postedAt: post?.scheduled_at || row.collected_at, // Fallback to collected_at if no scheduled_at
            analytics: [],
            latest: null,
            mediaUrls: post?.media_urls || undefined,
          });
        }

        const analytics: PostAnalytics = {
          id: row.id,
          post_id: row.post_id,
          tweet_id: row.tweet_id,
          user_id: userId,
          likes: row.likes,
          retweets: row.retweets,
          replies: row.replies,
          quotes: row.quotes,
          impressions: row.impressions,
          engagement_rate: row.engagement_rate,
          reach: row.reach,
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
