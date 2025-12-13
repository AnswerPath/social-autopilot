import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AutoReplyRule } from '@/lib/auto-reply/rule-engine';

export const runtime = 'nodejs';

// GET - List all auto-reply rules for a user
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    const { data: rules, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching auto-reply rules:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rules: rules || [],
    });
  } catch (error) {
    console.error('Error in GET /api/auto-reply/rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rules' },
      { status: 500 }
    );
  }
}

// POST - Create a new auto-reply rule
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();

    const {
      rule_name,
      keywords = [],
      phrases = [],
      response_template,
      is_active = true,
      priority = 0,
      throttle_settings = { max_per_hour: 10, max_per_day: 50, cooldown_minutes: 5 },
      match_type = 'any',
      sentiment_filter = [],
    } = body;

    // Validation
    if (!rule_name || !response_template) {
      return NextResponse.json(
        { success: false, error: 'rule_name and response_template are required' },
        { status: 400 }
      );
    }

    if (keywords.length === 0 && phrases.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one keyword or phrase is required' },
        { status: 400 }
      );
    }

    const { data: rule, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .insert({
        user_id: userId,
        rule_name,
        keywords,
        phrases,
        response_template,
        is_active,
        priority,
        throttle_settings,
        match_type,
        sentiment_filter,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating auto-reply rule:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rule,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/auto-reply/rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create rule' },
      { status: 500 }
    );
  }
}

// PATCH - Update an auto-reply rule
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const { data: rule, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      // Handle "no rows" case - Supabase .single() returns PGRST116 when no rows match
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Rule not found' },
          { status: 404 }
        );
      }
      console.error('Error updating auto-reply rule:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Error in PATCH /api/auto-reply/rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rule' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an auto-reply rule
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('auto_reply_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting auto-reply rule:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/auto-reply/rules:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete rule' },
      { status: 500 }
    );
  }
}

