import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// Helper function to get user ID (placeholder for demo)
function getUserId(): string {
  // In a real app, this would extract from JWT token or session
  return 'demo-user'
}

// GET /api/drafts - Get all drafts for the current user
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      drafts: data,
      pagination: {
        limit,
        offset,
        hasMore: data.length === limit
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch drafts' }, { status: 500 })
  }
}

// POST /api/drafts - Create a new draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, mediaUrls, autoSave = false } = body
    
    if (!content && !mediaUrls?.length) {
      return NextResponse.json({ error: 'Content or media is required' }, { status: 400 })
    }

    const userId = getUserId()

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        content: content?.trim() || '',
        media_urls: Array.isArray(mediaUrls) ? mediaUrls : null,
        status: 'draft',
        scheduled_at: new Date().toISOString(), // Default to now for drafts
        requires_approval: false,
        auto_saved: autoSave
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      draft: data,
      message: autoSave ? 'Draft auto-saved' : 'Draft created successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to create draft' }, { status: 500 })
  }
}
