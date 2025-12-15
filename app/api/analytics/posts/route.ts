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
    const userId = user?.id || request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const postId = searchParams.get('postId');
    const fetchFromApi = searchParams.get('fetchFromApi') === 'true';

    console.log(`📊 Analytics posts requested for userId: ${userId}, fetchFromApi: ${fetchFromApi}`);
    if (startDate && endDate) {
      console.log(`   Date range: ${startDate} to ${endDate}`);
    }
    
    // Diagnostic: Check if user has any scheduled posts at all
    const { data: anyPosts } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, status, posted_tweet_id, scheduled_at')
      .eq('user_id', userId)
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

    // If fetchFromApi is true, fetch fresh data from X API
    if (fetchFromApi) {
      if (postId) {
        // Fetch analytics for a specific post
        const fetchResult = await analyticsService.fetchPostAnalytics(userId, postId);
        
        if (!fetchResult.success) {
          return NextResponse.json(
            { success: false, error: fetchResult.error },
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
        const dateRange = startDate && endDate
          ? {
              startDate: new Date(startDate),
              endDate: new Date(endDate),
            }
          : undefined;

        const fetchResult = await analyticsService.fetchAllPostAnalytics(userId, dateRange);
        
        if (!fetchResult.success) {
          return NextResponse.json(
            { success: false, error: fetchResult.error },
            { status: 400 }
          );
        }

        // Store the fetched analytics
        if (fetchResult.analytics && fetchResult.analytics.length > 0) {
          console.log(`✅ Fetched ${fetchResult.analytics.length} analytics records from X API`);
          const storeResult = await analyticsService.storeAnalytics(fetchResult.analytics);
          if (storeResult.success) {
            console.log(`✅ Stored ${storeResult.count || fetchResult.analytics.length} analytics records in database`);
          } else {
            console.error(`❌ Failed to store analytics: ${storeResult.error}`);
          }
        } else {
          console.log(`⚠️ No analytics data returned from X API (this might be normal if no posts match the criteria)`);
        }

        // After storing, fetch the historical data in the format the dashboard expects
        // This ensures the response format is consistent whether fetching from API or database
        const historicalResult = await analyticsService.getHistoricalAnalytics(userId, dateRange);
        
        return NextResponse.json({
          success: true,
          data: historicalResult.data || [],
          analytics: fetchResult.analytics || [], // Also include raw analytics for backward compatibility
        });
      }
    } else {
      // Return stored analytics from database
      const dateRange = startDate && endDate
        ? {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          }
        : undefined;

      if (postId) {
        // Get historical analytics for a specific post
        const historicalResult = await analyticsService.getHistoricalAnalytics(userId, dateRange);
        
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
        const historicalResult = await analyticsService.getHistoricalAnalytics(userId, dateRange);
        
        if (!historicalResult.success) {
          console.error(`❌ Failed to get historical analytics: ${historicalResult.error}`);
          return NextResponse.json(
            { success: false, error: historicalResult.error },
            { status: 400 }
          );
        }

        const dataCount = historicalResult.data?.length || 0;
        console.log(`📊 Returning ${dataCount} posts with historical analytics from database`);
        
        if (dataCount === 0 && dateRange) {
          console.log(`⚠️ No analytics found. User may need to click Refresh to fetch from X API first.`);
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
    const userId = user?.id || request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    
    const { postIds, fetchAll } = body;

    const analyticsService = createPostAnalyticsService();

    if (fetchAll) {
      // Fetch analytics for all published posts
      const dateRange = body.startDate && body.endDate
        ? {
            startDate: new Date(body.startDate),
            endDate: new Date(body.endDate),
          }
        : undefined;

      const fetchResult = await analyticsService.fetchAllPostAnalytics(userId, dateRange);
      
      if (!fetchResult.success) {
        return NextResponse.json(
          { success: false, error: fetchResult.error },
          { status: 400 }
        );
      }

      // Store the fetched analytics
      if (fetchResult.analytics && fetchResult.analytics.length > 0) {
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
      });
    } else if (postIds && Array.isArray(postIds)) {
      // Fetch analytics for specific posts
      const results = [];
      const errors = [];

      for (const postId of postIds) {
        const fetchResult = await analyticsService.fetchPostAnalytics(userId, postId);
        
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
