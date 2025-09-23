import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

// GET /api/approval - Get approval statistics and pending posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'pending', 'statistics', 'history'
    const userId = getUserId()

    switch (type) {
      case 'pending':
        return await getPendingApprovals(userId)
      case 'statistics':
        return await getApprovalStatistics(userId)
      case 'history':
        return await getApprovalHistory(userId)
      default:
        return await getPendingApprovals(userId)
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to fetch approval data' }, { status: 500 })
  }
}

// POST /api/approval - Submit post for approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, action, comment, reason } = body
    
    if (!postId || !action) {
      return NextResponse.json({ error: 'postId and action are required' }, { status: 400 })
    }

    const userId = getUserId()
    
    switch (action) {
      case 'submit':
        return await submitForApproval(postId, userId)
      case 'approve':
        return await approvePost(postId, userId, comment)
      case 'reject':
        return await rejectPost(postId, userId, reason, comment)
      case 'request-revision':
        return await requestRevision(postId, userId, comment)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to process approval action' }, { status: 500 })
  }
}

// Helper functions
async function getPendingApprovals(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .select(`
      *,
      approval_comments (
        id,
        comment,
        comment_type,
        user_id,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'pending_approval')
    .order('submitted_for_approval_at', { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, posts: data || [] })
}

async function getApprovalStatistics(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('approval_statistics')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, statistics: data })
}

async function getApprovalHistory(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('approval_history')
    .select(`
      *,
      scheduled_posts (
        id,
        content,
        scheduled_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, history: data || [] })
}

async function submitForApproval(postId: string, userId: string) {
  // Update post status to pending_approval
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update({ 
      status: 'pending_approval',
      submitted_for_approval_at: new Date().toISOString()
    })
    .eq('id', postId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, post: data })
}

async function approvePost(postId: string, userId: string, comment?: string) {
  // Update post status to approved
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update({ 
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userId
    })
    .eq('id', postId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Add approval comment if provided
  if (comment) {
    await supabaseAdmin
      .from('approval_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        comment,
        comment_type: 'approval'
      })
  }

  return NextResponse.json({ success: true, post: data })
}

async function rejectPost(postId: string, userId: string, reason: string, comment?: string) {
  // Update post status to rejected
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update({ 
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_by: userId,
      rejection_reason: reason
    })
    .eq('id', postId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Add rejection comment
  await supabaseAdmin
    .from('approval_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      comment: comment || `Rejected: ${reason}`,
      comment_type: 'rejection'
    })

  return NextResponse.json({ success: true, post: data })
}

async function requestRevision(postId: string, userId: string, comment: string) {
  // Update post status to draft (for revision)
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update({ 
      status: 'draft'
    })
    .eq('id', postId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Add revision request comment
  await supabaseAdmin
    .from('approval_comments')
    .insert({
      post_id: postId,
      user_id: userId,
      comment,
      comment_type: 'revision_request'
    })

  return NextResponse.json({ success: true, post: data })
}
