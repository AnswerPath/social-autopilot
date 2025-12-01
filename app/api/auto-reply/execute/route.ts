import { NextRequest, NextResponse } from 'next/server';
import { createAutoReplyService } from '@/lib/auto-reply/service';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST - Manually trigger auto-reply for a mention
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    const { mentionId } = body;

    if (!mentionId) {
      return NextResponse.json(
        { success: false, error: 'mentionId is required' },
        { status: 400 }
      );
    }

    // Fetch mention from database
    const { data: mention, error: mentionError } = await supabaseAdmin
      .from('mentions')
      .select('*')
      .eq('id', mentionId)
      .eq('user_id', userId)
      .single();

    if (mentionError || !mention) {
      return NextResponse.json(
        { success: false, error: 'Mention not found' },
        { status: 404 }
      );
    }

    // Check if already replied
    if (mention.is_replied) {
      return NextResponse.json(
        { success: false, error: 'Mention already has a reply' },
        { status: 400 }
      );
    }

    // Create auto-reply service and process
    const service = createAutoReplyService({ userId });
    await service.initialize();

    const result = await service.processMention(mention);

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    console.error('Error in POST /api/auto-reply/execute:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to execute auto-reply' },
      { status: 500 }
    );
  }
}

