import { NextRequest, NextResponse } from 'next/server'
import { SchedulingService } from '@/lib/scheduling-service'
import { ParsedScheduledPost } from '@/lib/csv-parser'
import { getCurrentUser, createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'

export const runtime = 'nodejs'

/**
 * Import scheduled posts from CSV
 * POST /api/scheduled-posts/csv-import
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
        error: 'Maximum 100 posts allowed per import request' 
      }, { status: 400 })
    }

    const userId = user.id
    const schedulingService = new SchedulingService()

    interface ImportResult {
      success: boolean
      post?: unknown
      error?: string
    }

    const results: ImportResult[] = []
    const failures: Array<{ row: number; error: string; post: ParsedScheduledPost }> = []

    // Import posts sequentially (to respect conflict detection)
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i] as ParsedScheduledPost
      try {
        const result = await schedulingService.schedulePost({
          content: post.content,
          mediaUrls: post.mediaUrls,
          scheduledDate: post.scheduledDate,
          scheduledTime: post.scheduledTime,
          timezone: post.timezone,
          userId
        })

        if (result.success) {
          results.push({
            success: true,
            post: result.post
          })
        } else {
          results.push({
            success: false,
            error: result.error || 'Failed to schedule post'
          })
          failures.push({
            row: i + 1, // +1 because CSV rows are 1-indexed (header is row 1)
            error: result.error || 'Failed to schedule post',
            post
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          success: false,
          error: errorMessage
        })
        failures.push({
          row: i + 1,
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
        error: 'All posts failed to import',
        failures
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      totalCount: posts.length,
      failures: failures.length > 0 ? failures : undefined
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to import posts'
    console.error('CSV import error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to import posts',
      details: errorMessage
    }, { status: 500 })
  }
}


