import { NextRequest, NextResponse } from 'next/server';
import { createEngagementAnalyticsService } from '@/lib/analytics/engagement-analytics';

export const runtime = 'nodejs';

// GET - Get analytics data
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'metrics';
    const days = parseInt(searchParams.get('days') || '30', 10);

    const analyticsService = createEngagementAnalyticsService();

    switch (type) {
      case 'metrics': {
        const metrics = await analyticsService.getMetrics(userId);
        return NextResponse.json({
          success: true,
          metrics,
        });
      }

      case 'rules': {
        const performance = await analyticsService.getRulePerformance(userId);
        return NextResponse.json({
          success: true,
          performance,
        });
      }

      case 'timeseries': {
        const timeSeries = await analyticsService.getTimeSeriesData(userId, days);
        return NextResponse.json({
          success: true,
          timeSeries,
        });
      }

      case 'all': {
        const [metrics, performance, timeSeries] = await Promise.all([
          analyticsService.getMetrics(userId),
          analyticsService.getRulePerformance(userId),
          analyticsService.getTimeSeriesData(userId, days),
        ]);

        return NextResponse.json({
          success: true,
          metrics,
          performance,
          timeSeries,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in GET /api/auto-reply/analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

