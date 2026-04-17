import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSessionUserId } from '@/lib/require-session-user'

export const runtime = 'nodejs'

// GET /api/approval/[id] - Get approval details for a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    const { id: postId } = await params

    // Get post with approval details
    const { data: post, error: postError } = await supabaseAdmin
      .from('scheduled_posts')
      .select(`
        *,
        approval_comments (
          id,
          comment,
          comment_type,
          user_id,
          created_at,
          is_resolved
        ),
        approval_history (
          action,
          user_id,
          action_details,
          created_at
        )
      `)
      .eq('id', postId)
      .single()

    if (postError) {
      if (postError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      }
      return NextResponse.json({ success: false, error: postError.message }, { status: 500 })
    }

    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch approval details'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

// PATCH /api/approval/[id] - Update approval status or add comments
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    const { id: postId } = await params
    const body = await request.json()
    const { status, comment, commentType, resolveComment } = body

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, user_id')
      .eq('id', postId)
      .single()

    if (ownedError) {
      if (ownedError.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
      }
      return NextResponse.json({ success: false, error: ownedError.message }, { status: 500 })
    }
    if (!owned) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    if (owned.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Update post status if provided
    if (status) {
      const { error: updateError } = await supabaseAdmin
        .from('scheduled_posts')
        .update({ status })
        .eq('id', postId)
        .eq('user_id', userId)

      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
      }
    }

    // Add comment if provided
    if (comment) {
      const { error: commentError } = await supabaseAdmin
        .from('approval_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          comment,
          comment_type: commentType || 'feedback'
        })

      if (commentError) {
        return NextResponse.json({ success: false, error: commentError.message }, { status: 500 })
      }
    }

    // Resolve comment if provided
    if (resolveComment) {
      const { error: resolveError } = await supabaseAdmin
        .from('approval_comments')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId
        })
        .eq('id', resolveComment)
        .eq('post_id', postId)

      if (resolveError) {
        return NextResponse.json({ success: false, error: resolveError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update approval'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
