import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/approval/comments - Get comments for posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const commentType = searchParams.get('type')
    const resolved = searchParams.get('resolved')

    let query = supabaseAdmin
      .from('approval_comments')
      .select('*')
      .order('created_at', { ascending: false })

    if (postId) {
      query = query.eq('post_id', postId)
    }

    if (commentType) {
      query = query.eq('comment_type', commentType)
    }

    if (resolved !== null) {
      query = query.eq('is_resolved', resolved === 'true')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, comments: data || [] })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch comments'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

// POST /api/approval/comments - Add new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, comment, commentType, userId } = body

    if (!postId || !comment) {
      return NextResponse.json({ error: 'postId and comment are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('approval_comments')
      .insert({
        post_id: postId,
        user_id: userId || 'demo-user',
        comment,
        comment_type: commentType || 'feedback'
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, comment: data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create comment'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
