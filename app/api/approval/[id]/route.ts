import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// GET /api/approval/[id] - Get approval details for a specific post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id

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
      return NextResponse.json({ success: false, error: postError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, post })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch approval details' }, { status: 500 })
  }
}

// PATCH /api/approval/[id] - Update approval status or add comments
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id
    const body = await request.json()
    const { status, comment, commentType, resolveComment } = body

    const userId = 'demo-user' // In real app, get from auth

    // Update post status if provided
    if (status) {
      const { error: updateError } = await supabaseAdmin
        .from('scheduled_posts')
        .update({ status })
        .eq('id', postId)

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

      if (resolveError) {
        return NextResponse.json({ success: false, error: resolveError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to update approval' }, { status: 500 })
  }
}
