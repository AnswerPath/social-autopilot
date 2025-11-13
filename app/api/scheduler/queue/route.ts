import { NextRequest, NextResponse } from 'next/server'
import { getQueueMetrics } from '@/lib/job-queue'
import { getCurrentUser, createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'

export const runtime = 'nodejs'

/**
 * Get queue status and metrics
 * GET /api/scheduler/queue
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(_request)
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
        { status: 401 }
      )
    }

    const metrics = await getQueueMetrics()

    return NextResponse.json({
      success: true,
      metrics
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get queue metrics'
    console.error('Queue metrics error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get queue metrics',
      details: errorMessage
    }, { status: 500 })
  }
}


