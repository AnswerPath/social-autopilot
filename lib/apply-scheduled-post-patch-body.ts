import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SchedulingService } from '@/lib/scheduling-service'
import { recordRevision } from '@/lib/approval/revisions'
import { ensureWorkflowAssignment } from '@/lib/approval/workflow'

/**
 * Shared implementation for PATCH /api/scheduled-posts/:id and
 * POST /api/scheduled-posts with body.postId (same semantics).
 */
export async function applyScheduledPostPatchBody(
  id: string,
  userId: string,
  body: Record<string, unknown>
): Promise<NextResponse> {
  const update: Record<string, unknown> = {}

  if (body.scheduledDate && body.scheduledTime) {
    const schedulingService = new SchedulingService()
    const result = await schedulingService.reschedulePost(
      id,
      userId,
      String(body.scheduledDate),
      String(body.scheduledTime),
      body.timezone as string | undefined
    )

    if (!result.success) {
      if (result.conflictCheck && result.conflictCheck.hasConflict) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            conflictCheck: result.conflictCheck
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 400 }
      )
    }

    if (typeof body.content === 'string') update.content = body.content.trim()
    if (Array.isArray(body.mediaUrls)) update.media_urls = body.mediaUrls
  } else {
    if (typeof body.content === 'string') update.content = body.content.trim()
    if (Array.isArray(body.mediaUrls)) update.media_urls = body.mediaUrls
    if (body.scheduledAt != null && body.scheduledAt !== '') {
      const d = new Date(String(body.scheduledAt))
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid scheduledAt: could not parse as a date' },
          { status: 400 }
        )
      }
      update.scheduled_at = d.toISOString()
    }
  }

  if (body.status) update.status = body.status
  if (body.postedTweetId) update.posted_tweet_id = body.postedTweetId
  if (body.error) update.error = body.error

  if (body.submitForApproval === true && !update.status) {
    update.status = 'pending_approval'
    update.requires_approval = true
  } else if (body.submitForApproval === true) {
    update.status = 'pending_approval'
    update.requires_approval = true
  } else if (body.submitForApproval === false) {
    update.requires_approval = false
  }

  if (update.status === 'pending_approval' || body.status === 'pending_approval') {
    update.submitted_for_approval_at = new Date().toISOString()
    if (!update.requires_approval) update.requires_approval = true
  } else if (body.status === 'approved') {
    update.approved_at = new Date().toISOString()
    update.approved_by = (body.approvedBy as string) || userId
  } else if (body.status === 'rejected') {
    update.rejected_at = new Date().toISOString()
    update.rejected_by = (body.rejectedBy as string) || userId
    update.rejection_reason = body.rejectionReason
  }

  if (body.createRevision && body.status === 'draft') {
    update.parent_post_id = id
    update.revision_count = ((body.currentRevisionCount as number) || 0) + 1
  }

  if (Object.keys(update).length === 0) {
    const { data: currentPost, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }
    if (!currentPost) {
      return NextResponse.json(
        { success: false, error: 'Scheduled post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, post: currentPost })
  }

  const { data, error } = await supabaseAdmin
    .from('scheduled_posts')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  try {
    await recordRevision(
      data.id,
      userId,
      {
        content: data.content,
        media_urls: data.media_urls,
        scheduled_at: data.scheduled_at,
        status: data.status
      },
      undefined,
      'update'
    )
  } catch (err) {
    console.error('Failed to record revision for scheduled post update', err)
  }

  if (data.requires_approval || update.requires_approval) {
    try {
      await ensureWorkflowAssignment(data.id, userId)
    } catch (workflowError) {
      console.error('Failed to ensure workflow assignment for scheduled post update', workflowError)
    }
  }

  return NextResponse.json({
    success: true,
    post: data,
    requiresApproval: data.requires_approval || false,
    message: data.requires_approval
      ? 'Post updated and submitted for approval'
      : 'Post updated successfully'
  })
}
