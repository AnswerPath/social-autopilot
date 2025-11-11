import { NextRequest, NextResponse } from 'next/server'
import { SchedulingService } from '@/lib/scheduling-service'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { posts } = body

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ 
        error: 'Posts array is required and must not be empty' 
      }, { status: 400 })
    }

    const userId = getUserId()
    const schedulingService = new SchedulingService()

    const results: Array<{ success: boolean; post?: any; error?: string; index: number }> = []
    const failures: Array<{ index: number; error: string; post: any }> = []

    // Validate all posts first (pre-check for conflicts)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const { content, scheduledDate, scheduledTime, timezone } = post

      if (!content || !scheduledDate || !scheduledTime) {
        failures.push({
          index: i,
          error: 'Missing required fields: content, scheduledDate, or scheduledTime',
          post
        })
        continue
      }
    }

    // If validation fails, return early
    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed for some posts',
        failures
      }, { status: 400 })
    }

    // Schedule posts sequentially (to respect conflict detection)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      try {
        const result = await schedulingService.schedulePost({
          content: post.content,
          mediaUrls: post.mediaUrls,
          scheduledDate: post.scheduledDate,
          scheduledTime: post.scheduledTime,
          timezone: post.timezone,
          userId,
          status: post.status,
          requiresApproval: post.requiresApproval
        })

        if (result.success) {
          results.push({
            success: true,
            post: result.post,
            index: i
          })
        } else {
          results.push({
            success: false,
            error: result.error || 'Failed to schedule post',
            index: i
          })
          failures.push({
            index: i,
            error: result.error || 'Failed to schedule post',
            post
          })
        }
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Unknown error',
          index: i
        })
        failures.push({
          index: i,
          error: error.message || 'Unknown error',
          post
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    if (failureCount === posts.length) {
      return NextResponse.json({
        success: false,
        error: 'All posts failed to schedule',
        failures
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalCount: posts.length,
      results,
      failures: failures.length > 0 ? failures : undefined
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to bulk schedule posts',
      details: error.message
    }, { status: 500 })
  }
}

