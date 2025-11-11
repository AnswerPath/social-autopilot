import { NextRequest, NextResponse } from 'next/server'
import { SchedulingService } from '@/lib/scheduling-service'
import { ParsedScheduledPost } from '@/lib/csv-parser'

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

    const results: Array<{ success: boolean; post?: any; error?: string }> = []
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
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Unknown error'
        })
        failures.push({
          row: i + 1,
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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to import posts',
      details: error.message
    }, { status: 500 })
  }
}

