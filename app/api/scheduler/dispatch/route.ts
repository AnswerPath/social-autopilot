import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/job-queue'

export const runtime = 'nodejs'

/**
 * Enhanced dispatch endpoint with job queue processing and retry logic
 * 
 * Security: This endpoint can be called by:
 * 1. Vercel Cron Jobs (verified via x-vercel-cron header)
 * 2. Manual API calls (for testing/debugging)
 * 
 * In production, consider adding additional authentication if needed.
 */
/**
 * Process the scheduled posts queue
 * GET: Manual trigger (for testing/debugging)
 * POST: Called by Vercel Cron Jobs
 */
export async function GET(request: NextRequest) {
  // Allow GET for manual testing
  return POST(request)
}

export async function POST(request: NextRequest) {
  // Verify this is a Vercel cron job, scheduler worker, or allow manual calls in development
  const cronHeader = request.headers.get('x-vercel-cron')
  const workerHeader = request.headers.get('x-scheduler-worker')
  const isVercelCron = cronHeader === '1'
  const isSchedulerWorker = workerHeader === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Allow: Vercel cron jobs, scheduler worker, or manual calls in development
  if (!isDevelopment && !isVercelCron && !isSchedulerWorker) {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized: This endpoint can only be called by Vercel Cron Jobs or the Scheduler Worker'
    }, { status: 403 })
  }

  try {
    const result = await processQueue()

    return NextResponse.json({
      success: true,
      processed: result.processed,
      results: result.results
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Dispatch failed',
      details: error.message
    }, { status: 500 })
  }
}


