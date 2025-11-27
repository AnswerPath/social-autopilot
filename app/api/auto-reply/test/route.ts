import { NextRequest, NextResponse } from 'next/server';
import { RuleEngine, AutoReplyRule } from '@/lib/auto-reply/rule-engine';

export const runtime = 'nodejs';

// POST - Test a rule against sample text
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule, testText, sentiment } = body;

    if (!rule || !testText) {
      return NextResponse.json(
        { success: false, error: 'rule and testText are required' },
        { status: 400 }
      );
    }

    // Create rule engine and test
    const engine = new RuleEngine();
    engine.loadRules([rule as AutoReplyRule]);

    const result = engine.matchMention(testText, sentiment);

    // Generate response if matched
    let responseText = null;
    if (result.matched && result.rule) {
      responseText = engine.generateResponse(result.rule, {
        text: testText,
        author_username: 'test_user',
        author_name: 'Test User',
      });
    }

    return NextResponse.json({
      success: true,
      matched: result.matched,
      matchedKeywords: result.matchedKeywords,
      matchedPhrases: result.matchedPhrases,
      confidence: result.confidence,
      responseText,
    });
  } catch (error) {
    console.error('Error in POST /api/auto-reply/test:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test rule' },
      { status: 500 }
    );
  }
}

