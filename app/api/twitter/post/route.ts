import { NextRequest, NextResponse } from 'next/server'
import { postTweet, scheduleTweet } from '@/lib/twitter-api'
import { SchedulingService } from '@/lib/scheduling-service'
import { ensureWorkflowAssignment } from '@/lib/approval/workflow'
import { recordRevision } from '@/lib/approval/revisions'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, mediaIds, scheduledTime, requiresApproval } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tweet text is required' },
        { status: 400 }
      )
    }

    if (text.length > 280) {
      return NextResponse.json(
        { error: 'Tweet text exceeds 280 characters' },
        { status: 400 }
      )
    }

    let result
    if (scheduledTime) {
      // Schedule the tweet - save to scheduled_posts table
      const scheduledDate = new Date(scheduledTime)
      const year = scheduledDate.getFullYear()
      const month = String(scheduledDate.getMonth() + 1).padStart(2, '0')
      const day = String(scheduledDate.getDate()).padStart(2, '0')
      const hours = String(scheduledDate.getHours()).padStart(2, '0')
      const minutes = String(scheduledDate.getMinutes()).padStart(2, '0')

      const userId = getUserId()
      const schedulingService = new SchedulingService()
      
      // Save to scheduled_posts table
      const scheduleResult = await schedulingService.schedulePost({
        content: text,
        mediaUrls: mediaIds,
        scheduledDate: `${year}-${month}-${day}`,
        scheduledTime: `${hours}:${minutes}`,
        userId
      })

      if (!scheduleResult.success) {
        // Check if it's a conflict error
        if (scheduleResult.conflictCheck && scheduleResult.conflictCheck.hasConflict) {
          return NextResponse.json({
            error: scheduleResult.error,
            conflictCheck: scheduleResult.conflictCheck
          }, { status: 409 })
        }
        
        return NextResponse.json(
          { error: scheduleResult.error || 'Failed to schedule post' },
          { status: 400 }
        )
      }

      // Also call the twitter API scheduling (for backwards compatibility)
      result = await scheduleTweet(text, scheduledDate, mediaIds, userId)
      
      // Return the scheduled post data
      return NextResponse.json({
        success: true,
        post: scheduleResult.post,
        jobId: result.jobId,
        message: 'Post scheduled successfully'
      })
    } else {
      // Post immediately or route into approval workflow if required
      if (requiresApproval === true) {
        const userId = getUserId()
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')

        const schedulingService = new SchedulingService()
        const scheduleResult = await schedulingService.schedulePost({
          content: text,
          mediaUrls: mediaIds,
          scheduledDate: `${year}-${month}-${day}`,
          scheduledTime: `${hours}:${minutes}`,
          userId,
          status: 'pending_approval',
          requiresApproval: true
        })

        if (!scheduleResult.success) {
          return NextResponse.json(
            { error: scheduleResult.error || 'Failed to submit for approval' },
            { status: 400 }
          )
        }

        try {
          await ensureWorkflowAssignment((scheduleResult.post as any).id, userId)
        } catch (err) {
          // Non-fatal; approvals UI may have limited metadata without assignment
          console.error('Failed to ensure workflow assignment for immediate post', err)
        }

        try {
          await recordRevision(
            (scheduleResult.post as any).id,
            userId,
            {
              content: (scheduleResult.post as any).content,
              media_urls: (scheduleResult.post as any).media_urls,
              scheduled_at: (scheduleResult.post as any).scheduled_at,
              status: (scheduleResult.post as any).status
            },
            undefined,
            'create'
          )
        } catch (err) {
          console.error('Failed to record revision for immediate approval post', err)
        }

        return NextResponse.json({
          success: true,
          post: scheduleResult.post,
          message: 'Post submitted for approval'
        })
      } else {
        result = await postTweet(text, mediaIds)
      }
    }

    if (result.success) {
      return NextResponse.json(result.data || { jobId: result.jobId })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
