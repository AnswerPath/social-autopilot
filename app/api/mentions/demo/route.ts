import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSentimentService } from '@/lib/sentiment/sentiment-service';
import { createFlaggingService } from '@/lib/priority/flagging-service';
import { createAutoReplyService } from '@/lib/auto-reply/service';

export const runtime = 'nodejs';

// Demo mentions data for testing without X API credentials
// These are templates that will be used to generate mentions with unique IDs
const DEMO_MENTION_TEMPLATES = [
  {
    author_id: 'demo-author-1',
    author_username: 'happy_customer',
    author_name: 'Happy Customer',
    text: 'Love the new update! Great work team! 👏',
  },
  {
    author_id: 'demo-author-2',
    author_username: 'needs_help',
    author_name: 'Needs Help',
    text: 'I need help with my account. How do I reset my password?',
  },
  {
    author_id: 'demo-author-3',
    author_username: 'frustrated_user',
    author_name: 'Frustrated User',
    text: 'This is terrible! The app keeps crashing. Very disappointed.',
  },
  {
    author_id: 'demo-author-4',
    author_username: 'question_asker',
    author_name: 'Question Asker',
    text: 'Can you help me understand how to use the new feature?',
  },
  {
    author_id: 'demo-author-5',
    author_username: 'support_seeker',
    author_name: 'Support Seeker',
    text: 'Having issues with login, can someone help?',
  },
  {
    author_id: 'demo-author-6',
    author_username: 'excited_user',
    author_name: 'Excited User',
    text: 'This feature is amazing! Just what I needed. Thank you! 🎉',
  },
  {
    author_id: 'demo-author-7',
    author_username: 'confused_customer',
    author_name: 'Confused Customer',
    text: 'How does the new feature work? I can\'t figure it out.',
  },
  {
    author_id: 'demo-author-8',
    author_username: 'angry_user',
    author_name: 'Angry User',
    text: 'This is unacceptable! Lost all my data. Need immediate help!',
  },
  {
    author_id: 'demo-author-9',
    author_username: 'satisfied_client',
    author_name: 'Satisfied Client',
    text: 'Been using this for a week now. Really impressed with the quality!',
  },
  {
    author_id: 'demo-author-10',
    author_username: 'tech_savvy',
    author_name: 'Tech Savvy',
    text: 'Is there an API available? Would love to integrate this into my workflow.',
  },
];

// POST - Generate demo mentions for testing
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }
    const count = body.count || 5;

    // IMPORTANT: Check if real credentials exist before generating demo mentions
    // This prevents demo mentions from being created when user has real credentials
    try {
      const { getUnifiedCredentials } = await import('@/lib/unified-credentials');
      const credentialsResult = await getUnifiedCredentials(userId);
      
      if (credentialsResult.success && credentialsResult.credentials) {
        const creds = credentialsResult.credentials;
        // Check if credentials are real (not demo)
        if (creds.apiKey && creds.apiKeySecret && creds.accessToken && creds.accessTokenSecret &&
            !creds.apiKey.includes('demo_') && !creds.apiKeySecret.includes('demo_') &&
            !creds.accessToken.includes('demo_') && !creds.accessTokenSecret.includes('demo_')) {
          console.log('⚠️ [Demo Mentions] Real credentials detected - refusing to generate demo mentions');
          return NextResponse.json(
            {
              success: false,
              error: 'Cannot generate demo mentions when real X API credentials are configured. Please remove credentials first or use the real API.',
              blocked: true
            },
            { status: 403 }
          );
        }
      }
    } catch (credCheckError) {
      // If credential check fails, log but continue (might be a transient error)
      console.warn('⚠️ [Demo Mentions] Could not check credentials, proceeding with demo generation:', credCheckError);
    }

    console.log(`[Demo Mentions] Generating ${count} demo mentions for user: ${userId}`);

    const sentimentService = createSentimentService();
    const flaggingService = createFlaggingService();
    const createdMentions = [];
    const errors = [];

    // Generate demo mentions
    // Randomly select from templates to add variety
    const shuffled = [...DEMO_MENTION_TEMPLATES].sort(() => Math.random() - 0.5);
    const selectedTemplates = shuffled.slice(0, Math.min(count, DEMO_MENTION_TEMPLATES.length));
    
    for (let i = 0; i < selectedTemplates.length; i++) {
      const template = selectedTemplates[i];
      const mentionText = template.text;
      const timestamp = Date.now() + i; // Ensure unique timestamps

      // Analyze sentiment
      const sentimentAnalysis = sentimentService.analyze(mentionText);
      console.log(`[Demo Mentions] Sentiment analysis for "${mentionText.substring(0, 50)}...":`, {
        sentiment: sentimentAnalysis.sentiment,
        confidence: sentimentAnalysis.confidence,
        score: sentimentAnalysis.score,
        comparative: sentimentAnalysis.comparative
      });

      // Create mention in database with unique tweet_id
      const uniqueTweetId = `demo-${timestamp}-${i}-${Math.random().toString(36).substring(7)}`;
      
      const { data: mention, error } = await supabaseAdmin
        .from('mentions')
        .insert({
          user_id: userId,
          tweet_id: uniqueTweetId,
          author_id: template.author_id,
          author_username: template.author_username,
          author_name: template.author_name || null,
          text: mentionText,
          sentiment: sentimentAnalysis.sentiment || null,
          sentiment_confidence: sentimentAnalysis.confidence || 0,
        })
        .select()
        .single();

      if (error) {
        const errorDetails = {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        };
        console.error(`[Demo Mentions] Error creating mention ${i + 1}:`, errorDetails);
        
        // If it's a duplicate key error, that's okay - skip it
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          console.log(`[Demo Mentions] Mention ${uniqueTweetId} already exists, skipping`);
          continue;
        }
        
        // Collect error for reporting
        errors.push(`Mention ${i + 1}: ${error.message || 'Unknown error'}`);
        // Continue with next mention
        continue;
      }

      // Evaluate and flag if needed
      if (mention) {
        try {
          await flaggingService.evaluateMention(mention);
        } catch (flagError) {
          console.error('Error evaluating mention for flagging:', flagError);
          // Continue even if flagging fails
        }
        createdMentions.push(mention);
        
        // Process auto-reply for this mention (demo mode - will log but not send)
        try {
          const autoReplyService = createAutoReplyService({ userId });
          await autoReplyService.initialize();
          const autoReplyResult = await autoReplyService.processMention(mention as any);
          
          if (autoReplyResult.success) {
            console.log(`[Demo Mentions] Auto-reply generated for mention ${mention.id}: ${autoReplyResult.responseText?.substring(0, 50)}...`);
          } else if (autoReplyResult.error && autoReplyResult.error !== 'No matching rule found') {
            console.log(`[Demo Mentions] Auto-reply processing result: ${autoReplyResult.error}`);
          }
        } catch (autoReplyError) {
          console.error('[Demo Mentions] Error processing auto-reply:', autoReplyError);
          // Continue even if auto-reply fails
        }
      }
    }

    const result = {
      success: createdMentions.length > 0,
      message: `Generated ${createdMentions.length} demo mention${createdMentions.length !== 1 ? 's' : ''}`,
      mentions: createdMentions,
    };

    if (errors.length > 0) {
      result.message += ` (${errors.length} error${errors.length !== 1 ? 's' : ''} occurred)`;
      console.warn(`[Demo Mentions] Completed with ${errors.length} error(s):`, errors);
    }

    if (createdMentions.length === 0) {
      console.error('[Demo Mentions] No mentions were created. Check database connection and table structure.');
      return NextResponse.json(
        {
          success: false,
          error: 'No mentions were created. Check database connection and ensure the mentions table exists.',
          errors: errors,
        },
        { status: 500 }
      );
    }

    console.log(`[Demo Mentions] Successfully created ${createdMentions.length} mention(s)`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating demo mentions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate demo mentions',
      },
      { status: 500 }
    );
  }
}

// GET - Get demo mentions (for viewing)
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { data: mentions, error } = await supabaseAdmin
      .from('mentions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      mentions: mentions || [],
      count: mentions?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching demo mentions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch mentions',
      },
      { status: 500 }
    );
  }
}

