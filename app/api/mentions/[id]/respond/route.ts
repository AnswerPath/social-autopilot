import { NextRequest, NextResponse } from 'next/server';
import { createFlaggingService } from '@/lib/priority/flagging-service';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST - Record human response to a flagged mention
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { id: mentionId } = await params;
    const body = await request.json();
    const { action, notes, responseText } = body;

    if (!action || !['responded', 'ignored', 'escalated'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be: responded, ignored, or escalated' },
        { status: 400 }
      );
    }

    // Verify mention exists and belongs to user
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

    // Record human response
    const flaggingService = createFlaggingService();
    await flaggingService.recordHumanResponse(mentionId, action, notes);

    // If responded, update mention with reply
    if (action === 'responded' && responseText) {
      // Note: In a real implementation, you'd send the reply via X API
      // For now, we'll just mark it as processed
      const { error: updateError } = await supabaseAdmin
        .from('mentions')
        .update({
          is_replied: true,
          reply_text: responseText,
          processed_at: new Date().toISOString(),
        })
        .eq('id', mentionId);

      if (updateError) {
        console.error('Error updating mention with response:', updateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Human response recorded: ${action}`,
    });
  } catch (error) {
    console.error('Error in POST /api/mentions/[id]/respond:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record response' },
      { status: 500 }
    );
  }
}

