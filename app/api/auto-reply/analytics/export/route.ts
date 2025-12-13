import { NextRequest, NextResponse } from 'next/server';
import { createEngagementAnalyticsService } from '@/lib/analytics/engagement-analytics';

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

// GET - Export analytics data as CSV
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '30', 10);

    const analyticsService = createEngagementAnalyticsService();

    if (format === 'csv') {
      const timeSeries = await analyticsService.getTimeSeriesData(userId, days);
      
      // Convert to CSV
      const headers = ['Date', 'Mentions', 'Replies', 'Flagged', 'Positive', 'Negative', 'Neutral'];
      const rows = timeSeries.map(d => [
        escapeCSV(d.date),
        escapeCSV(d.mentions),
        escapeCSV(d.replies),
        escapeCSV(d.flagged),
        escapeCSV(d.positive),
        escapeCSV(d.negative),
        escapeCSV(d.neutral),
      ]);

      const csv = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="engagement-analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON export
    const [metrics, performance, timeSeries] = await Promise.all([
      analyticsService.getMetrics(userId),
      analyticsService.getRulePerformance(userId),
      analyticsService.getTimeSeriesData(userId, days),
    ]);

    return NextResponse.json({
      success: true,
      exportDate: new Date().toISOString(),
      metrics,
      performance,
      timeSeries,
    });
  } catch (error) {
    console.error('Error in GET /api/auto-reply/analytics/export:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export analytics' },
      { status: 500 }
    );
  }
}

