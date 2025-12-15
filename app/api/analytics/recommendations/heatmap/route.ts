import { NextRequest, NextResponse } from 'next/server';
import { createRecommendationService } from '@/lib/analytics/recommendation-service';

/**
 * GET /api/analytics/recommendations/heatmap
 * Get heatmap data for optimal posting times visualization
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';

    const recommendationService = createRecommendationService();
    const result = await recommendationService.getHeatmapData(userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      heatmap: result.data || [],
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/recommendations/heatmap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate heatmap data' },
      { status: 500 }
    );
  }
}
