import { NextRequest, NextResponse } from 'next/server'
import { SchedulingService } from '@/lib/scheduling-service'
import { getCurrentUser, createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'

export const runtime = 'nodejs'

/**
 * Bulk schedule multiple posts
 * POST /api/scheduled-posts/bulk
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { posts } = body

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ 
        error: 'Posts array is required and must not be empty' 
      }, { status: 400 })
    }

    // Validate array size to prevent DoS
    if (posts.length > 100) {
      return NextResponse.json({ 
        error: 'Maximum 100 posts allowed per bulk request' 
      }, { status: 400 })
    }

    const userId = user.id
    const schedulingService = new SchedulingService()

    interface BulkResult {
      success: boolean
      post?: unknown
      error?: string
      index: number
    }

    interface BulkFailure {
      index: number
      error: string
      post: unknown
    }

    const results: BulkResult[] = []
    const failures: BulkFailure[] = []

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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          error: errorMessage,
          index: i
        })
        failures.push({
          index: i,
          error: errorMessage,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to bulk schedule posts'
    console.error('Bulk schedule error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to bulk schedule posts',
      details: errorMessage
    }, { status: 500 })
  }
}


