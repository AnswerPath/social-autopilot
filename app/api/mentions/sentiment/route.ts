import { NextRequest, NextResponse } from 'next/server';
import { createSentimentService } from '@/lib/sentiment/sentiment-service';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST - Analyze sentiment for text or mention
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    const { text, mentionId, batch } = body;

    const sentimentService = createSentimentService();

    // Batch analysis
    if (batch && Array.isArray(batch)) {
      const analyses = sentimentService.analyzeBatch(batch);
      const distribution = sentimentService.getDistribution(analyses);

      return NextResponse.json({
        success: true,
        analyses,
        distribution,
      });
    }

    // Single text analysis
    if (text) {
      const analysis = sentimentService.analyze(text);

      return NextResponse.json({
        success: true,
        analysis,
      });
    }

    // Analyze mention by ID
    if (mentionId) {
      const { data: mention, error } = await supabaseAdmin
        .from('mentions')
        .select('*')
        .eq('id', mentionId)
        .eq('user_id', userId)
        .single();

      if (error || !mention) {
        return NextResponse.json(
          { success: false, error: 'Mention not found' },
          { status: 404 }
        );
      }

      const analysis = sentimentService.analyze(mention.text);

      // Update mention with sentiment
      const { error: updateError } = await supabaseAdmin
        .from('mentions')
        .update({
          sentiment: analysis.sentiment,
          sentiment_confidence: analysis.confidence,
        })
        .eq('id', mentionId);

      if (updateError) {
        console.error('Error updating mention sentiment:', updateError);
      }

      return NextResponse.json({
        success: true,
        analysis,
        mention: {
          ...mention,
          sentiment: analysis.sentiment,
          sentiment_confidence: analysis.confidence,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'text, mentionId, or batch is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST /api/mentions/sentiment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}

// PATCH - Update sentiment for a mention (manual override)
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    const { mentionId, sentiment, confidence } = body;

    if (!mentionId || !sentiment) {
      return NextResponse.json(
        { success: false, error: 'mentionId and sentiment are required' },
        { status: 400 }
      );
    }

    if (!['positive', 'neutral', 'negative'].includes(sentiment)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sentiment value' },
        { status: 400 }
      );
    }

    const { data: mention, error } = await supabaseAdmin
      .from('mentions')
      .update({
        sentiment,
        sentiment_confidence: confidence || 1.0,
      })
      .eq('id', mentionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating mention sentiment:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!mention) {
      return NextResponse.json(
        { success: false, error: 'Mention not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      mention,
    });
  } catch (error) {
    console.error('Error in PATCH /api/mentions/sentiment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update sentiment' },
      { status: 500 }
    );
  }
}

