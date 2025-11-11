import { NextRequest, NextResponse } from 'next/server'
import { retryFailedJob, cancelJob } from '@/lib/job-queue'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

/**
 * Retry a failed job manually
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to retry job',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Cancel a scheduled job
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = getUserId()
    const result = await cancelJob(id, userId)

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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to cancel job',
      details: error.message
    }, { status: 500 })
  }
}

