import { NextRequest, NextResponse } from 'next/server'
import { postTweet, scheduleTweet } from '@/lib/twitter-api'
import { SchedulingService } from '@/lib/scheduling-service'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, mediaIds, scheduledTime } = body

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
      // Post immediately
      result = await postTweet(text, mediaIds)
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
