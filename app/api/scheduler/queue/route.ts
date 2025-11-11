import { NextRequest, NextResponse } from 'next/server'
import { getQueueMetrics } from '@/lib/job-queue'

export const runtime = 'nodejs'

/**
 * Get queue status and metrics
 */
export async function GET(_request: NextRequest) {
  try {
    const metrics = await getQueueMetrics()

    return NextResponse.json({
      success: true,
      metrics
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get queue metrics',
      details: error.message
    }, { status: 500 })
  }
}

