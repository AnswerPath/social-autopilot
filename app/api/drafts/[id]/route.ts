import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// Helper function to get user ID (placeholder for demo)
function getUserId(): string {
  // In a real app, this would extract from JWT token or session
  return 'demo-user'
}

// GET /api/drafts/[id] - Get a specific draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = getUserId()

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'draft')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, draft: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch draft' }, { status: 500 })
  }
}

// PUT /api/drafts/[id] - Update a draft
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, mediaUrls, autoSave = false } = body
    
    const userId = getUserId()

    // Check if draft exists and belongs to user
    const { data: existingDraft, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'draft')
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
      }
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (content !== undefined) {
      updateData.content = content.trim()
    }
    if (mediaUrls !== undefined) {
      updateData.media_urls = Array.isArray(mediaUrls) ? mediaUrls : null
    }
    if (autoSave) {
      updateData.auto_saved = true
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'draft')
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      draft: data,
      message: autoSave ? 'Draft auto-saved' : 'Draft updated successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to update draft' }, { status: 500 })
  }
}

// DELETE /api/drafts/[id] - Delete a draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = getUserId()

    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'draft')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Draft deleted successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete draft' }, { status: 500 })
  }
}
