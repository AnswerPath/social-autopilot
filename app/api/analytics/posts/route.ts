import { NextRequest, NextResponse } from 'next/server';
import { createPostAnalyticsService } from '@/lib/analytics/post-analytics-service';
import { getCurrentUser } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/analytics/posts
 * Fetch analytics for posts with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const headerUserId = request.headers.get('x-user-id');
    
    // Prioritize server-side authentication over header
    // But log if they don't match for debugging
    const userId = user?.id || headerUserId;
    
    console.log(`🔍 Analytics GET request:`);
    console.log(`   getCurrentUser result:`, user ? `user.id=${user.id}` : 'null');
    console.log(`   Header x-user-id:`, headerUserId);
    console.log(`   Final userId:`, userId);
    
    if (user?.id && headerUserId && user.id !== headerUserId) {
      console.warn(`⚠️ User ID mismatch! Server: ${user.id}, Client header: ${headerUserId}`);
      console.warn(`   Using server-side user ID: ${user.id}`);
    }
    
    if (!userId) {
      console.error('❌ No authenticated user found in analytics request');
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in to view analytics.' },
        { status: 401 }
      );
    }
    
    // Always use server-side authenticated user ID if available
    const finalUserId = user?.id || userId;
    console.log(`   Using final userId: ${finalUserId}`);
    
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const postId = searchParams.get('postId');
    const fetchFromApi = searchParams.get('fetchFromApi') === 'true';
    
    console.log(`📊 Analytics posts requested for userId: ${finalUserId}, fetchFromApi: ${fetchFromApi}`);
    if (startDate && endDate) {
      console.log(`   Raw date range from URL: ${startDate} to ${endDate}`);
    }
    
    // Diagnostic: Check if user has any scheduled posts at all
    const { data: anyPosts } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, status, posted_tweet_id, scheduled_at')
      .eq('user_id', finalUserId)
      .limit(5);
    console.log(`🔍 Diagnostic: User has ${anyPosts?.length || 0} total scheduled posts in database`);
    if (anyPosts && anyPosts.length > 0) {
      console.log(`   Sample posts:`, anyPosts.map((p: any) => ({
        id: p.id,
        status: p.status,
        has_tweet_id: !!p.posted_tweet_id,
        scheduled_at: p.scheduled_at,
      })));
    }

    const analyticsService = createPostAnalyticsService();

    // If fetchFromApi is true, fetch fresh data from analytics service (Apify preferred, X API fallback)
    if (fetchFromApi) {
      if (postId) {
        // Fetch analytics for a specific post
        const fetchResult = await analyticsService.fetchPostAnalytics(finalUserId, postId);
        
        if (!fetchResult.success) {
          const source = (fetchResult as any).source || 'x-api';
          const sourceName = source === 'apify' ? 'Apify' : 'X API';
          return NextResponse.json(
            { 
              success: false, 
              error: fetchResult.error || `Failed to fetch analytics from ${sourceName}`,
              source: source,
            },
            { status: 400 }
          );
        }

        // Store the fetched analytics
        if (fetchResult.analytics) {
          await analyticsService.storeAnalytics(fetchResult.analytics);
        }

        return NextResponse.json({
          success: true,
          analytics: fetchResult.analytics,
        });
      } else {
        // Fetch analytics for all posts in date range
        // Parse dates correctly - if in YYYY-MM-DD format, append time to ensure UTC parsing
        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;
        
        if (startDate) {
          // If date is in YYYY-MM-DD format, append T00:00:00.000Z for UTC parsing
          const dateStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
          parsedStartDate = new Date(dateStr);
          console.log(`   Parsed startDate: ${startDate} -> ${parsedStartDate.toISOString()}`);
        }
        
        if (endDate) {
          // If date is in YYYY-MM-DD format, append T23:59:59.999Z for end of day in UTC
          const dateStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
          parsedEndDate = new Date(dateStr);
          console.log(`   Parsed endDate: ${endDate} -> ${parsedEndDate.toISOString()}`);
        }
        
        const dateRange = parsedStartDate && parsedEndDate
          ? {
              startDate: parsedStartDate,
              endDate: parsedEndDate,
            }
          : undefined;

        if (dateRange) {
          console.log(`   Final date range for fetchAllPostAnalytics: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`);
        }

        const fetchResult = await analyticsService.fetchAllPostAnalytics(finalUserId, dateRange);
        
        if (!fetchResult.success) {
          // Check if this is an Apify failure - if so, don't silently fall back to historical data
          // This ensures users know Apify needs to be fixed
          const source = (fetchResult as any).source || 'x-api';
          const sourceName = source === 'apify' ? 'Apify' : 'X API';
          const errorMessage = fetchResult.error || `Failed to fetch analytics from ${sourceName}`;
          
          if (source === 'apify') {
            // For Apify failures, return error with stored data as fallback
            // This makes it clear that Apify needs attention
            console.error(`❌ Apify fetch failed: ${errorMessage}`);
            console.log(`   Attempting to return stored data from database as fallback...`);
            
            const historicalResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
            
            // Return error status but include historical data so dashboard can still show something
            return NextResponse.json(
              {
                success: false, // Mark as failure to indicate Apify issue
                error: `Apify analytics fetch failed: ${errorMessage}. Showing stored data from database. Please check your Apify configuration and try again.`,
                data: historicalResult.data || [],
                warning: 'Apify is not returning results. Please check your Apify account, actor configuration, and run logs.',
                source: source,
              },
              { status: 200 } // Still return 200 so frontend can display the data
            );
          } else {
            // For non-Apify failures, return stored data as before
            console.log(`⚠️ API fetch failed: ${errorMessage}. Attempting to return stored data from database...`);
            const historicalResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
            
            return NextResponse.json({
              success: true,
              data: historicalResult.data || [],
              warning: errorMessage + '. Showing stored data from database.',
              source: source,
            });
          }
        }

        // Store the fetched analytics
        if (fetchResult.analytics && fetchResult.analytics.length > 0) {
          const source = fetchResult.source || 'x-api';
          const sourceName = source === 'apify' ? 'Apify' : 'X API';
          console.log(`✅ Fetched ${fetchResult.analytics.length} analytics records from ${sourceName}`);
          const storeResult = await analyticsService.storeAnalytics(fetchResult.analytics);
          if (storeResult.success) {
            console.log(`✅ Stored ${storeResult.count || fetchResult.analytics.length} analytics records in database`);
          } else {
            console.error(`❌ Failed to store analytics: ${storeResult.error}`);
          }
        } else {
          const source = fetchResult.source || 'x-api';
          const sourceName = source === 'apify' ? 'Apify' : 'X API';
          console.log(`⚠️ No analytics data returned from ${sourceName} (this might be normal if no posts match the criteria)`);
        }

        // After storing, fetch the historical data in the format the dashboard expects
        // This ensures the response format is consistent whether fetching from API or database
        const historicalResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
        
        return NextResponse.json({
          success: true,
          data: historicalResult.data || [],
          analytics: fetchResult.analytics || [], // Also include raw analytics for backward compatibility
          source: fetchResult.source || 'x-api', // Include source information
        });
      }
    } else {
      // Return stored analytics from database
      // Parse dates correctly - if in YYYY-MM-DD format, append time to ensure UTC parsing
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;
      
      if (startDate) {
        // If date is in YYYY-MM-DD format, append T00:00:00.000Z for UTC parsing
        const dateStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
        parsedStartDate = new Date(dateStr);
      }
      
      if (endDate) {
        // If date is in YYYY-MM-DD format, append T23:59:59.999Z for end of day in UTC
        const dateStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
        parsedEndDate = new Date(dateStr);
      }
      
      const dateRange = parsedStartDate && parsedEndDate
        ? {
            startDate: parsedStartDate,
            endDate: parsedEndDate,
          }
        : undefined;

      if (postId) {
        // Get historical analytics for a specific post
        const historicalResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
        
        if (!historicalResult.success) {
          return NextResponse.json(
            { success: false, error: historicalResult.error },
            { status: 400 }
          );
        }

        // Filter to the specific post
        const postData = historicalResult.data?.find(d => d.postId === postId);
        
        return NextResponse.json({
          success: true,
          data: postData || null,
        });
      } else {
        // Get all historical analytics
        const historicalResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
        
        if (!historicalResult.success) {
          console.error(`❌ Failed to get historical analytics: ${historicalResult.error}`);
          return NextResponse.json(
            { success: false, error: historicalResult.error },
            { status: 400 }
          );
        }

        const dataCount = historicalResult.data?.length || 0;
        console.log(`📊 Returning ${dataCount} posts with historical analytics from database`);
        
        // Check if there's any raw analytics data in the database before auto-fetching
        // This prevents unnecessary API calls when data exists but isn't formatted correctly
        let hasRawData = false;
        if (dataCount === 0) {
          const { data: rawCheck } = await supabaseAdmin
            .from('post_analytics')
            .select('id')
            .eq('user_id', finalUserId)
            .limit(1);
          hasRawData = (rawCheck?.length || 0) > 0;
          if (hasRawData) {
            console.log(`⚠️ Found raw analytics data in database but getHistoricalAnalytics returned 0 records. This may indicate a data formatting issue.`);
          }
        }
        
        // Auto-fetch from analytics service (Apify only) if no data exists
        // Only auto-fetch if there's truly no data in the database
        if (dataCount === 0 && !hasRawData && !fetchFromApi) {
          // Check for Apify credentials to provide helpful message
          const { hasApifyCredentials } = await import('@/lib/apify-storage');
          const apifyCheck = await hasApifyCredentials(finalUserId);
          const hasApify = apifyCheck.success && apifyCheck.hasCredentials;
          
          if (hasApify) {
            console.log(`⚠️ No analytics found in database. Automatically fetching from Apify...`);
          } else {
            console.log(`⚠️ No analytics found in database. Apify credentials required for analytics.`);
            console.log(`💡 Please configure Apify credentials in Settings → Integrations to fetch analytics.`);
            return NextResponse.json({
              success: false,
              error: 'No analytics data found and Apify credentials are not configured. Please configure Apify credentials in Settings → Integrations to fetch analytics data.',
              data: [],
            });
          }
          
          const fetchResult = await analyticsService.fetchAllPostAnalytics(finalUserId, dateRange);
          
          // If Apify fetch fails, return error instead of silently falling back
          if (!fetchResult.success) {
            const errorMsg = fetchResult.error || 'Failed to fetch analytics from Apify';
            console.error(`❌ Auto-fetch from Apify failed: ${errorMsg}`);
            return NextResponse.json(
              {
                success: false,
                error: `Failed to fetch analytics from Apify: ${errorMsg}. Please check your Apify configuration, verify the username is correct, and check the Apify run logs.`,
                data: [],
                source: 'apify',
              },
              { status: 200 } // Return 200 so frontend can display error message
            );
          }
          
          if (fetchResult.success && fetchResult.analytics && fetchResult.analytics.length > 0) {
            const source = fetchResult.source || 'x-api';
            const sourceName = source === 'apify' ? 'Apify' : 'X API';
            console.log(`✅ Fetched ${fetchResult.analytics.length} analytics records from ${sourceName}`);
            const storeResult = await analyticsService.storeAnalytics(fetchResult.analytics);
            if (storeResult.success) {
              console.log(`✅ Stored ${storeResult.count || fetchResult.analytics.length} analytics records in database`);
              // Re-fetch from database to return stored data
              const updatedResult = await analyticsService.getHistoricalAnalytics(finalUserId, dateRange);
              return NextResponse.json({
                success: true,
                data: updatedResult.data || [],
                fetchedFromApi: true,
                source: source,
              });
            } else {
              console.error(`❌ Failed to store analytics: ${storeResult.error}`);
              return NextResponse.json({
                success: true,
                data: [],
                warning: `Fetched ${fetchResult.analytics.length} records from ${sourceName} but failed to store them: ${storeResult.error}`,
                source: source,
              });
            }
          } else {
            // Return empty data but include warning
            const source = fetchResult.source || 'x-api';
            const sourceName = source === 'apify' ? 'Apify' : 'X API';
            const errorMessage = fetchResult.error || `Failed to fetch analytics from ${sourceName}. Please check your credentials or try again later.`;
            console.log(`⚠️ Auto-fetch failed: ${errorMessage}`);
            return NextResponse.json({
              success: true,
              data: [],
              warning: errorMessage,
              source: source,
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: historicalResult.data || [],
        });
      }
    }
  } catch (error) {
    console.error('Error in GET /api/analytics/posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/posts
 * Trigger analytics collection for specific posts
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const headerUserId = request.headers.get('x-user-id');
    
    // Prioritize server-side authentication over header
    const userId = user?.id || headerUserId;
    
    console.log(`🔍 Analytics POST request:`);
    console.log(`   getCurrentUser result:`, user ? `user.id=${user.id}` : 'null');
    console.log(`   Header x-user-id:`, headerUserId);
    console.log(`   Final userId:`, userId);
    
    if (user?.id && headerUserId && user.id !== headerUserId) {
      console.warn(`⚠️ User ID mismatch! Server: ${user.id}, Client header: ${headerUserId}`);
      console.warn(`   Using server-side user ID: ${user.id}`);
    }
    
    if (!userId) {
      console.error('❌ No authenticated user found in analytics POST request');
      return NextResponse.json(
        { success: false, error: 'Authentication required. Please log in to fetch analytics.' },
        { status: 401 }
      );
    }
    
    // Always use server-side authenticated user ID if available
    const finalUserId = user?.id || userId;
    console.log(`   Using final userId: ${finalUserId}`);
    
    const body = await request.json();
    
    const { postIds, fetchAll, retryFromRunId, username, startDate, endDate } = body;

    const analyticsService = createPostAnalyticsService();

    // Handle retry from Apify run ID (for when data was fetched but failed to store)
    if (retryFromRunId) {
      console.log(`🔄 Retrying analytics store from Apify run ID: ${retryFromRunId}`);
      
      // Try to get username from stored credentials if not provided
      let finalUsername = username;
      if (!finalUsername) {
        const { getXUsername } = await import('@/lib/apify-storage');
        const usernameResult = await getXUsername(finalUserId);
        if (usernameResult.success && usernameResult.username) {
          finalUsername = usernameResult.username;
          console.log(`✅ Using stored X username: ${finalUsername}`);
        }
      }
      
      if (!finalUsername) {
        return NextResponse.json(
          { success: false, error: 'Username is required. Please provide it in the request body or ensure it\'s stored in Settings → Integrations.' },
          { status: 400 }
        );
      }

      try {
        const { getApifyCredentials } = await import('@/lib/apify-storage');
        const { createApifyService } = await import('@/lib/apify-service');
        const apifyCredentialsResult = await getApifyCredentials(finalUserId);
        
        if (!apifyCredentialsResult.success || !apifyCredentialsResult.credentials) {
          return NextResponse.json(
            { success: false, error: 'Apify credentials not found. Cannot retry from run ID.' },
            { status: 400 }
          );
        }

        const apifyService = createApifyService(apifyCredentialsResult.credentials);
        
        // Parse dates correctly - if in YYYY-MM-DD format, append time to ensure UTC parsing
        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;
        
        if (startDate) {
          const dateStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
          parsedStartDate = new Date(dateStr);
        }
        
        if (endDate) {
          const dateStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
          parsedEndDate = new Date(dateStr);
        }
        
        const dateRange = parsedStartDate && parsedEndDate
          ? {
              startDate: parsedStartDate,
              endDate: parsedEndDate,
            }
          : undefined;

        // Fetch data from the specific run ID (reading datasets is usually free)
        const apifyResult = await apifyService.getPostAnalyticsFromRun(
          retryFromRunId,
          finalUsername,
          dateRange
        );

        if (!apifyResult.success || !apifyResult.posts || apifyResult.posts.length === 0) {
          // Return 200 with error message instead of 400, since the request is valid
          // The issue is that the dataset is empty, not that the request was bad
          return NextResponse.json(
            { 
              success: false, 
              error: apifyResult.error || 'No posts found in the specified Apify run',
              details: 'The Apify run completed successfully, but the dataset appears to be empty. This could mean: 1) The dataset was not created properly, 2) The data is stored in a different location (key-value store), or 3) The run found no posts matching the criteria. Check the server logs for more details.',
            },
            { status: 200 }
          );
        }

        console.log(`✅ Fetched ${apifyResult.posts.length} posts from Apify run ${retryFromRunId}`);

        // Get scheduled posts to link analytics
        const { data: scheduledPosts } = await supabaseAdmin
          .from('scheduled_posts')
          .select('id, posted_tweet_id')
          .eq('user_id', finalUserId)
          .not('posted_tweet_id', 'is', null);
        
        // Create a map of tweet_id -> post_id for quick lookup
        const tweetIdToPostId = new Map<string, string>();
        if (scheduledPosts) {
          scheduledPosts.forEach((post: any) => {
            if (post.posted_tweet_id) {
              const tweetIdStr = String(post.posted_tweet_id);
              tweetIdToPostId.set(tweetIdStr, post.id);
              const cleanTweetId = tweetIdStr.trim();
              if (cleanTweetId !== tweetIdStr) {
                tweetIdToPostId.set(cleanTweetId, post.id);
              }
            }
          });
        }

        // Transform Apify posts to PostAnalytics format
        const analytics = apifyResult.posts.map((post) => {
          const tweetId = String(post.id || post.url.split('/').pop() || '').trim();
          let postId: string | null = null;
          
          // Try to find matching scheduled post
          postId = tweetIdToPostId.get(tweetId) || null;
          if (!postId) {
            const numericId = tweetId.replace(/[^0-9]/g, '');
            if (numericId && numericId !== tweetId) {
              postId = tweetIdToPostId.get(numericId) || null;
            }
          }
          
          // Validate postId is UUID if not null
          if (postId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) {
            console.error(`❌ Invalid UUID for scheduled_post_id: "${postId}" (tweet_id: ${tweetId}). Setting to null.`);
            postId = null;
          }
          
          const engagementRate = analyticsService.calculateEngagementRate(
            post.likes,
            post.retweets,
            post.replies,
            post.impressions
          );
          
          return {
            post_id: postId,
            tweet_id: tweetId,
            user_id: finalUserId,
            likes: post.likes,
            retweets: post.retweets,
            replies: post.replies,
            quotes: post.quotes || 0,
            impressions: post.impressions,
            engagement_rate: engagementRate || undefined,
            reach: undefined,
            collected_at: new Date(),
          };
        });

        // Store the analytics
        const storeResult = await analyticsService.storeAnalytics(analytics);
        
        if (!storeResult.success) {
          return NextResponse.json(
            { success: false, error: storeResult.error },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          count: analytics.length,
          stored: storeResult.count || analytics.length,
          message: `Successfully stored ${storeResult.count || analytics.length} analytics records from Apify run ${retryFromRunId}`,
          source: 'apify',
        });
      } catch (error) {
        console.error('Error retrying from Apify run ID:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to retry from Apify run ID',
          },
          { status: 500 }
        );
      }
    }

    if (fetchAll) {
      // Fetch analytics for all published posts
      const dateRange = body.startDate && body.endDate
        ? {
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
          }
        : undefined;

      const fetchResult = await analyticsService.fetchAllPostAnalytics(finalUserId, dateRange);
      
      if (!fetchResult.success) {
        const source = fetchResult.source || 'x-api';
        const sourceName = source === 'apify' ? 'Apify' : 'X API';
        return NextResponse.json(
          { 
            success: false, 
            error: fetchResult.error || `Failed to fetch analytics from ${sourceName}`,
            source: source,
          },
          { status: 400 }
        );
      }

      // Store the fetched analytics
      if (fetchResult.analytics && fetchResult.analytics.length > 0) {
        const source = fetchResult.source || 'x-api';
        const sourceName = source === 'apify' ? 'Apify' : 'X API';
        console.log(`✅ Fetched ${fetchResult.analytics.length} analytics records from ${sourceName}`);
        const storeResult = await analyticsService.storeAnalytics(fetchResult.analytics);
        
        if (!storeResult.success) {
          return NextResponse.json(
            { success: false, error: storeResult.error },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        count: fetchResult.analytics?.length || 0,
        analytics: fetchResult.analytics || [],
        source: fetchResult.source || 'x-api',
      });
    } else if (postIds && Array.isArray(postIds)) {
      // Fetch analytics for specific posts
      const results = [];
      const errors = [];

      for (const postId of postIds) {
        const fetchResult = await analyticsService.fetchPostAnalytics(finalUserId, postId);
        
        if (fetchResult.success && fetchResult.analytics) {
          const storeResult = await analyticsService.storeAnalytics(fetchResult.analytics);
          
          if (storeResult.success) {
            results.push(fetchResult.analytics);
          } else {
            errors.push({ postId, error: storeResult.error });
          }
        } else {
          errors.push({ postId, error: fetchResult.error });
        }
      }

      return NextResponse.json({
        success: true,
        count: results.length,
        analytics: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Either postIds array or fetchAll flag must be provided' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/analytics/posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to collect analytics' },
      { status: 500 }
    );
  }
}
