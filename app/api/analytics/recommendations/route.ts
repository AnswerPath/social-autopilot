import { NextRequest, NextResponse } from 'next/server';
import { createRecommendationService } from '@/lib/analytics/recommendation-service';

/**
 * GET /api/analytics/recommendations
 * Get AI-driven recommendations for optimal posting times
 * 
 * Query params:
 * - dayOfWeek: Optional. Filter recommendations for a specific day (0-6, Sunday-Saturday)
 * - includeHeatmap: Optional. Include heatmap data in response (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    const dayOfWeek = searchParams.get('dayOfWeek');
    const includeHeatmap = searchParams.get('includeHeatmap') === 'true';

    const recommendationService = createRecommendationService();

    let result;
    if (dayOfWeek !== null) {
      const day = parseInt(dayOfWeek, 10);
      if (isNaN(day) || day < 0 || day > 6) {
        return NextResponse.json(
          { success: false, error: 'Invalid dayOfWeek. Must be 0-6 (Sunday-Saturday)' },
          { status: 400 }
        );
      }
      result = await recommendationService.getRecommendedTimesForDay(userId, day);
    } else {
      result = await recommendationService.generateRecommendations(userId);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const response: any = {
      success: true,
      recommendations: result.recommendations || [],
    };

    // Include heatmap data if requested
    if (includeHeatmap) {
      const heatmapResult = await recommendationService.getHeatmapData(userId);
      if (heatmapResult.success) {
        response.heatmap = heatmapResult.data;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/analytics/recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}
