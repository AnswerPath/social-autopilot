import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  advanceWorkflowStep,
  bulkAdvanceWorkflow,
  ensureWorkflowAssignment,
  getApprovalDashboard,
  getApprovalStats,
  getPendingApprovals
} from '@/lib/approval/workflow'
import { getApprovalNotifications, markNotificationsRead } from '@/lib/approval/notifications'
import {
  createApprovalComment,
  getApprovalComments,
  resolveApprovalComment
} from '@/lib/approval/comments'
import { listRevisions, recordRevision, restoreRevision } from '@/lib/approval/revisions'

export const runtime = 'nodejs'

function getUserId(): string {
  // Default author identity for demo data
  return 'demo-user'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    // For dashboard/notifications we operate as the reviewer/manager,
    // for other reads we stay as content author.
    const userId = type === 'dashboard' || type === 'notifications' ? 'manager-user' : getUserId()

    switch (type) {
      case 'pending': {
        const postId = searchParams.get('postId') || undefined
        const posts = await getPendingApprovals(userId, postId)
        return NextResponse.json({ success: true, posts })
      }
      case 'statistics': {
        const statistics = await getApprovalStats(userId)
        return NextResponse.json({ success: true, statistics })
      }
      case 'history':
        return await getApprovalHistory(userId)
      case 'dashboard': {
        const rows = await getApprovalDashboard(userId)
        return NextResponse.json({ success: true, rows })
      }
      case 'notifications': {
        const notifications = await getApprovalNotifications(userId)
        return NextResponse.json({ success: true, notifications })
      }
      case 'comments': {
        const postId = searchParams.get('postId')
        if (!postId) {
          return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 })
        }
        const comments = await getApprovalComments(postId)
        return NextResponse.json({ success: true, comments })
      }
      case 'revisions': {
        const postId = searchParams.get('postId')
        if (!postId) {
          return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 })
        }
        const revisions = await listRevisions(postId)
        return NextResponse.json({ success: true, revisions })
      }
      default: {
        const posts = await getPendingApprovals(userId)
        return NextResponse.json({ success: true, posts })
      }
    }
  } catch (error) {
    console.error('Approval GET failed', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch approval data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId, action } = body
    // Submit/comment are authored actions; approvals are reviewer actions
    const userId =
      action === 'submit' || action === 'comment'
        ? getUserId()
        : 'manager-user'

    switch (action) {
      case 'submit':
        if (!postId) return missingPostId()
        return await submitForApproval(postId, userId, body.workflowId)
      case 'approve':
        if (!postId) return missingPostId()
        await advanceWorkflowStep(postId, userId, 'approve', { comment: body.comment })
        return NextResponse.json({ success: true })
      case 'reject':
        if (!postId) return missingPostId()
        await advanceWorkflowStep(postId, userId, 'reject', {
          comment: body.comment,
          reason: body.reason
        })
        return NextResponse.json({ success: true })
      case 'request-revision':
        if (!postId) return missingPostId()
        await advanceWorkflowStep(postId, userId, 'request_changes', { comment: body.comment })
        return NextResponse.json({ success: true })
      case 'bulk-approve': {
        const postIds: string[] = body.postIds || []
        const decision: 'approve' | 'reject' = body.decision || 'approve'
        const result = await bulkAdvanceWorkflow(postIds, userId, decision)
        return NextResponse.json({
          success: true,
          // keep legacy `result` for existing callers
          result,
          // and expose richer metadata for future use
          updatedCount: result.success.length,
          failedIds: result.failed
        })
      }
      case 'comment':
        if (!postId || !body.comment) {
          return NextResponse.json({ success: false, error: 'postId and comment are required' }, { status: 400 })
        }
        await createApprovalComment({
          postId,
          userId,
          comment: body.comment,
          parentCommentId: body.parentCommentId,
          commentType: body.commentType,
          mentions: body.mentions,
          workflowStepId: body.workflowStepId
        })
        return NextResponse.json({ success: true })
      case 'resolve-comment':
        if (!body.commentId) {
          return NextResponse.json({ success: false, error: 'commentId is required' }, { status: 400 })
        }
        await resolveApprovalComment(body.commentId, userId, body.resolution)
        return NextResponse.json({ success: true })
      case 'notifications-read':
        await markNotificationsRead(body.notificationIds || [], userId)
        return NextResponse.json({ success: true })
      case 'restore-revision':
        if (!postId || !body.revisionId) {
          return NextResponse.json({ success: false, error: 'postId and revisionId are required' }, { status: 400 })
        }
        return await handleRevisionRestore(postId, body.revisionId, userId)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Approval POST failed', error)
    return NextResponse.json({ success: false, error: 'Failed to process approval action' }, { status: 500 })
  }
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

async function submitForApproval(postId: string, userId: string, workflowId?: string) {
  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update({
      status: 'pending_approval',
      submitted_for_approval_at: new Date().toISOString(),
      requires_approval: true
    })
    .eq('id', postId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  await ensureWorkflowAssignment(postId, data.user_id, workflowId)
  return NextResponse.json({ success: true, post: data })
}

async function handleRevisionRestore(postId: string, revisionId: string, actorId: string) {
  const revision = await restoreRevision(postId, revisionId)
  if (!revision) {
    return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
  }

  const { snapshot } = revision
  const updatePayload: Record<string, any> = {}

  if (snapshot.content) updatePayload.content = snapshot.content
  if (snapshot.media_urls) updatePayload.media_urls = snapshot.media_urls
  if (snapshot.scheduled_at) updatePayload.scheduled_at = snapshot.scheduled_at

  if (Object.keys(updatePayload).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('scheduled_posts')
      .update(updatePayload)
      .eq('id', postId)

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }
  }

  await recordRevision(
    postId,
    actorId,
    snapshot,
    { restoredFrom: revisionId },
    'restored_version'
  )

  return NextResponse.json({ success: true })
}

function missingPostId() {
  return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 })
}
