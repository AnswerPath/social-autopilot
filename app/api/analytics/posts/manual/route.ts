import { NextRequest, NextResponse } from 'next/server';
import { createPostAnalyticsService } from '@/lib/analytics/post-analytics-service';
import { getCurrentUser } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/analytics/posts/manual
 * Manually store Apify analytics data
 * Accepts Apify-formatted data and stores it in the database
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const headerUserId = request.headers.get('x-user-id');
    
    const userId = user?.id || headerUserId;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const finalUserId = user?.id || userId;
    const body = await request.json();
    
    // Accept either 'posts' array or direct array
    const apifyPosts = body.posts || body;
    
    if (!Array.isArray(apifyPosts)) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected an array of posts.' },
        { status: 400 }
      );
    }
    
    if (apifyPosts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No posts provided' },
        { status: 400 }
      );
    }
    
    console.log(`📥 Manual analytics import: ${apifyPosts.length} posts for user ${finalUserId}`);
    
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
    
    const analyticsService = createPostAnalyticsService();
    
    // Transform Apify posts to PostAnalytics format
    const analytics = apifyPosts.map((post: any) => {
      // Extract tweet ID from postId, id, or postUrl
      const tweetId = String(
        post.postId || 
        post.id || 
        post.postUrl?.split('/').pop() || 
        ''
      ).trim();
      
      if (!tweetId) {
        console.warn(`⚠️ Skipping post with no tweet ID:`, post);
        return null;
      }
      
      // Try to find matching scheduled post
      let postId: string | null = null;
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
      
      // Map Apify field names to analytics format
      const likes = post.favouriteCount || post.likes || 0;
      const retweets = post.repostCount || post.retweets || 0;
      const replies = post.replyCount || post.replies || 0;
      const quotes = post.quoteCount || post.quotes || 0;
      const impressions = post.impressions || null;
      
      const engagementRate = analyticsService.calculateEngagementRate(
        likes,
        retweets,
        replies,
        impressions
      );
      
      return {
        post_id: postId,
        tweet_id: tweetId,
        user_id: finalUserId,
        likes: Number(likes) || 0,
        retweets: Number(retweets) || 0,
        replies: Number(replies) || 0,
        quotes: Number(quotes) || 0,
        impressions: impressions !== null && impressions !== undefined ? Number(impressions) : null,
        engagement_rate: engagementRate || undefined,
        reach: undefined,
        collected_at: new Date(),
      };
    }).filter((a: any) => a !== null);
    
    if (analytics.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid posts to store after processing' },
        { status: 400 }
      );
    }
    
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
      message: `Successfully stored ${storeResult.count || analytics.length} analytics records`,
    });
  } catch (error) {
    console.error('Error in manual analytics import:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

