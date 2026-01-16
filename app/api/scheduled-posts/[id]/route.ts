import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SchedulingService } from '@/lib/scheduling-service'
import { recordRevision } from '@/lib/approval/revisions'
import { ensureWorkflowAssignment } from '@/lib/approval/workflow'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const userId = getUserId()
    const update: any = {}
    
    // Handle rescheduling with timezone support and conflict detection
    if (body.scheduledDate && body.scheduledTime) {
      const schedulingService = new SchedulingService()
      const result = await schedulingService.reschedulePost(
        id,
        userId,
        body.scheduledDate,
        body.scheduledTime,
        body.timezone
      )

      if (!result.success) {
        if (result.conflictCheck && result.conflictCheck.hasConflict) {
          return NextResponse.json({ 
            success: false, 
            error: result.error,
            conflictCheck: result.conflictCheck
          }, { status: 409 })
        }
        
        return NextResponse.json({ 
          success: false, 
          error: result.error 
        }, { status: 400 })
      }

      // Rescheduling successful, update other fields if provided
      if (typeof body.content === 'string') update.content = body.content.trim()
      if (Array.isArray(body.mediaUrls)) update.media_urls = body.mediaUrls
    } else {
      // Legacy format or non-rescheduling updates
      if (typeof body.content === 'string') update.content = body.content.trim()
      if (Array.isArray(body.mediaUrls)) update.media_urls = body.mediaUrls
      if (body.scheduledAt) update.scheduled_at = new Date(body.scheduledAt).toISOString()
    }
    
    if (body.status) update.status = body.status
    if (body.postedTweetId) update.posted_tweet_id = body.postedTweetId
    if (body.error) update.error = body.error

    // Handle submitForApproval flag (convert to status if needed)
    if (body.submitForApproval === true && !update.status) {
      update.status = 'pending_approval'
      update.requires_approval = true
    } else if (body.submitForApproval === true) {
      // If status is already set, ensure it's pending_approval
      update.status = 'pending_approval'
      update.requires_approval = true
    } else if (body.submitForApproval === false) {
      update.requires_approval = false
    }

    // Handle approval workflow updates
    if (update.status === 'pending_approval' || body.status === 'pending_approval') {
      update.submitted_for_approval_at = new Date().toISOString()
      if (!update.requires_approval) update.requires_approval = true
    } else if (body.status === 'approved') {
      update.approved_at = new Date().toISOString()
      update.approved_by = body.approvedBy || userId
    } else if (body.status === 'rejected') {
      update.rejected_at = new Date().toISOString()
      update.rejected_by = body.rejectedBy || userId
      update.rejection_reason = body.rejectionReason
    }

    // Handle revision creation
    if (body.createRevision && body.status === 'draft') {
      update.parent_post_id = id
      update.revision_count = (body.currentRevisionCount || 0) + 1
    }

    // Only update if there are changes
    if (Object.keys(update).length === 0) {
      // Fetch current post to return
      const { data: currentPost } = await supabaseAdmin
        .from('scheduled_posts')
        .select('*')
        .eq('id', id)
        .single()
      
      return NextResponse.json({ success: true, post: currentPost })
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    // Record revision as non-fatal operation - don't fail the update if revision logging fails
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
      // Intentionally non-fatal: main update already succeeded.
    }

    // If this post requires approval, attach it to a workflow so that
    // it appears in the Approvals dashboard and can progress through steps.
    if (data.requires_approval || update.requires_approval) {
      try {
        await ensureWorkflowAssignment(data.id, userId)
      } catch (workflowError) {
        console.error('Failed to ensure workflow assignment for scheduled post update', workflowError)
        // Do not fail the main request – approvals UI may be limited but post update succeeded.
      }
    }

    return NextResponse.json({ 
      success: true, 
      post: data,
      requiresApproval: data.requires_approval || false,
      message: data.requires_approval ? 'Post updated and submitted for approval' : 'Post updated successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update scheduled post',
      details: error.message 
    }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete scheduled post' }, { status: 500 })
  }
}
