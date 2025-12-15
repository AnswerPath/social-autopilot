import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { createPostAnalyticsService } from '@/lib/analytics/post-analytics-service';

export const runtime = 'nodejs';

/**
 * Escape CSV values to prevent injection attacks and malformed output
 */
function escapeCSV(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'csv';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const analyticsService = createPostAnalyticsService();

    // Fetch summary metrics
    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    const summaryResult = await analyticsService.getAnalyticsSummary(userId, dateRange);
    const summary = summaryResult.success ? summaryResult.summary : null;

    // Fetch post analytics
    const postsResult = await analyticsService.getHistoricalAnalytics(userId, dateRange);
    const posts = postsResult.success && postsResult.data ? postsResult.data : [];

    if (format === 'csv') {
      const csvRows: string[] = [];

      // Add header
      csvRows.push('Analytics Report');
      csvRows.push(`Generated: ${new Date().toISOString()}`);
      csvRows.push(`Date Range: ${startDate} to ${endDate}`);
      csvRows.push('');

      // Summary Metrics Section
      csvRows.push('=== SUMMARY METRICS ===');
      if (summary) {
        const totalEngagement = summary.totalLikes + summary.totalRetweets + summary.totalReplies;
        const engagementRate = summary.totalImpressions > 0
          ? ((totalEngagement / summary.totalImpressions) * 100).toFixed(2)
          : '0.00';

        csvRows.push(['Metric', 'Value'].map(escapeCSV).join(','));
        csvRows.push(['Total Posts', escapeCSV(summary.totalPosts || 0)]);
        csvRows.push(['Total Impressions', escapeCSV(summary.totalImpressions || 0)]);
        csvRows.push(['Total Likes', escapeCSV(summary.totalLikes || 0)]);
        csvRows.push(['Total Retweets', escapeCSV(summary.totalRetweets || 0)]);
        csvRows.push(['Total Replies', escapeCSV(summary.totalReplies || 0)]);
        csvRows.push(['Total Engagement', escapeCSV(totalEngagement)]);
        csvRows.push(['Engagement Rate (%)', escapeCSV(engagementRate)]);
        csvRows.push(['Average Engagement Rate (%)', escapeCSV(summary.averageEngagementRate?.toFixed(2) || '0.00')]);
      } else {
        csvRows.push('No summary data available');
      }
      csvRows.push('');

      // Post Analytics Section
      csvRows.push('=== POST ANALYTICS ===');
      if (Array.isArray(posts) && posts.length > 0) {
        // Headers
        csvRows.push([
          'Post ID',
          'Tweet ID',
          'Content',
          'Posted Date',
          'Impressions',
          'Likes',
          'Retweets',
          'Replies',
          'Total Engagement',
          'Engagement Rate (%)'
        ].map(escapeCSV).join(','));

        // Data rows
        posts.forEach((post: any) => {
          const latest = post.latest || {};
          const impressions = latest.impressions || 0;
          const likes = latest.likes || 0;
          const retweets = latest.retweets || 0;
          const replies = latest.replies || 0;
          const totalEngagement = likes + retweets + replies;
          const engagementRate = impressions > 0
            ? ((totalEngagement / impressions) * 100).toFixed(2)
            : '0.00';

          const postedDate = post.postedAt 
            ? new Date(post.postedAt).toISOString().split('T')[0]
            : '';

          csvRows.push([
            escapeCSV(post.postId || ''),
            escapeCSV(post.tweetId || ''),
            escapeCSV(post.content || ''),
            escapeCSV(postedDate),
            escapeCSV(impressions),
            escapeCSV(likes),
            escapeCSV(retweets),
            escapeCSV(replies),
            escapeCSV(totalEngagement),
            escapeCSV(engagementRate)
          ].join(','));
        });
      } else {
        csvRows.push('No post analytics data available');
      }

      const csv = csvRows.join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-report-${startDate}-to-${endDate}.csv"`,
        },
      });
    }

    // JSON export (for future use)
    return NextResponse.json({
      success: true,
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      summary: summary,
      posts: posts,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/export:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}
