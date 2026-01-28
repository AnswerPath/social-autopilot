import { NextRequest, NextResponse } from 'next/server';
import { createPostAnalyticsService } from '@/lib/analytics/post-analytics-service';
import { getCurrentUser } from '@/lib/auth-utils';

/**
 * GET /api/analytics/summary
 * Get analytics summary (totals, averages) for a user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    console.log(`📊 Analytics summary requested for userId: ${userId}`);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (startDate && endDate) {
      console.log(`   Raw date range from URL: ${startDate} to ${endDate}`);
    }

    const analyticsService = createPostAnalyticsService();

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
      console.log(`   Final date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`);
    }

    const summaryResult = await analyticsService.getAnalyticsSummary(userId, dateRange);
    
    if (!summaryResult.success) {
      console.error(`❌ Failed to get analytics summary: ${summaryResult.error}`);
      return NextResponse.json(
        { success: false, error: summaryResult.error },
        { status: 400 }
      );
    }

    const summary = summaryResult.summary;
    if (summary) {
      console.log(`📊 Summary: ${summary.totalPosts} posts, ${summary.totalImpressions} impressions, ${summary.totalLikes} likes`);
    } else {
      console.log(`⚠️ No summary data found. User may need to click Refresh to fetch from X API first.`);
    }

    return NextResponse.json({
      success: true,
      summary: summaryResult.summary,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics summary' },
      { status: 500 }
    );
  }
}

