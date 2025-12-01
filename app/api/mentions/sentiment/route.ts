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

// PUT - Batch re-analyze all mentions without sentiment
export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    const { analyzeAll, limit } = body;

    const sentimentService = createSentimentService();

    // Get mentions without sentiment or with null sentiment
    let query = supabaseAdmin
      .from('mentions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!analyzeAll) {
      // Only get mentions without sentiment (null or empty string)
      query = query.or('sentiment.is.null,sentiment.eq.')
    }

    if (limit) {
      query = query.limit(limit);
    } else if (!analyzeAll) {
      query = query.limit(100); // Default limit for safety
    }

    const { data: mentions, error } = await query;

    if (error) {
      console.error('Error fetching mentions for re-analysis:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!mentions || mentions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No mentions found to analyze',
        analyzed: 0,
        distribution: { positive: 0, neutral: 0, negative: 0 },
      });
    }

    console.log(`[Sentiment Re-analysis] Analyzing ${mentions.length} mentions for user ${userId}`);

    let analyzed = 0;
    let errors = 0;
    const distribution = { positive: 0, neutral: 0, negative: 0 };

    // Analyze each mention
    for (const mention of mentions) {
      try {
        const analysis = sentimentService.analyze(mention.text);
        
        // Update mention with sentiment
        const { error: updateError } = await supabaseAdmin
          .from('mentions')
          .update({
            sentiment: analysis.sentiment,
            sentiment_confidence: analysis.confidence,
          })
          .eq('id', mention.id);

        if (updateError) {
          console.error(`Error updating mention ${mention.id}:`, updateError);
          errors++;
        } else {
          analyzed++;
          distribution[analysis.sentiment]++;
          console.log(`[Sentiment Re-analysis] Updated mention ${mention.id}: ${analysis.sentiment} (${analysis.confidence.toFixed(2)}) - "${mention.text.substring(0, 50)}..."`);
        }
      } catch (error) {
        console.error(`Error analyzing mention ${mention.id}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Analyzed ${analyzed} mentions`,
      analyzed,
      errors,
      distribution,
      total: mentions.length,
    });
  } catch (error) {
    console.error('Error in PUT /api/mentions/sentiment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to re-analyze mentions' },
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

