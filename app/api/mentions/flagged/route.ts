import { NextRequest, NextResponse } from 'next/server';
import { createFlaggingService } from '@/lib/priority/flagging-service';
import { requireSessionUserId } from '@/lib/require-session-user';

export const runtime = 'nodejs';

// GET - Get all flagged mentions
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserId(request);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const flaggingService = createFlaggingService();
    const flaggedMentions = await flaggingService.getFlaggedMentions(userId, limit);

    return NextResponse.json({
      success: true,
      mentions: flaggedMentions,
      count: flaggedMentions.length,
    });
  } catch (error) {
    console.error('Error in GET /api/mentions/flagged:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch flagged mentions' },
      { status: 500 }
    );
  }
}

