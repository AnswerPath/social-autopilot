import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SchedulingService } from '@/lib/scheduling-service'
import { recordRevision } from '@/lib/approval/revisions'

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

    // Handle approval workflow updates
    if (body.status === 'pending_approval') {
      update.submitted_for_approval_at = new Date().toISOString()
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

    return NextResponse.json({ success: true, post: data })
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
