import { NextRequest, NextResponse } from 'next/server'
import { retryFailedJob, cancelJob } from '@/lib/job-queue'
import { getCurrentUser, createAuthError } from '@/lib/auth-utils'
import { AuthErrorType } from '@/lib/auth-types'

export const runtime = 'nodejs'

/**
 * Retry a failed job manually
 * POST /api/scheduler/queue/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
        { status: 401 }
      )
    }

    const { id } = await params
    
    // Validate job ID format (UUID)
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Invalid job ID'
      }, { status: 400 })
    }

    const result = await retryFailedJob(id)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Job scheduled for retry'
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retry job'
    console.error('Retry job error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retry job',
      details: errorMessage
    }, { status: 500 })
  }
}

/**
 * Cancel a scheduled job
 * DELETE /api/scheduler/queue/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.UNAUTHORIZED, 'Authentication required') },
        { status: 401 }
      )
    }

    const { id } = await params
    
    // Validate job ID format (UUID)
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Invalid job ID'
      }, { status: 400 })
    }

    const result = await cancelJob(id, user.id)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully'
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel job'
    console.error('Cancel job error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to cancel job',
      details: errorMessage
    }, { status: 500 })
  }
}


