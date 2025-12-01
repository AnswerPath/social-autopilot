import { NextRequest, NextResponse } from 'next/server';
import { createFlaggingService } from '@/lib/priority/flagging-service';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST - Manually flag a mention
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const mentionId = params.id;

    // Fetch mention
    const { data: mention, error: fetchError } = await supabaseAdmin
      .from('mentions')
      .select('*')
      .eq('id', mentionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !mention) {
      return NextResponse.json(
        { success: false, error: 'Mention not found' },
        { status: 404 }
      );
    }

    // Evaluate and flag
    const flaggingService = createFlaggingService();
    const result = await flaggingService.evaluateMention(mention);

    if (!result.flagged) {
      // Force flag even if score is below threshold
      await flaggingService.flagMention(
        mentionId,
        result.priorityScore,
        result.priorityLevel,
        result.reasons
      );
    }

    return NextResponse.json({
      success: true,
      flagged: true,
      priorityScore: result.priorityScore,
      priorityLevel: result.priorityLevel,
      reasons: result.reasons,
    });
  } catch (error) {
    console.error('Error in POST /api/mentions/[id]/flag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to flag mention' },
      { status: 500 }
    );
  }
}

// DELETE - Unflag a mention
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const mentionId = params.id;

    const flaggingService = createFlaggingService();
    await flaggingService.unflagMention(mentionId);

    return NextResponse.json({
      success: true,
      message: 'Mention unflagged',
    });
  } catch (error) {
    console.error('Error in DELETE /api/mentions/[id]/flag:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unflag mention' },
      { status: 500 }
    );
  }
}

