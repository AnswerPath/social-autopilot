import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/job-queue'
import { createLogger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * Process the scheduled posts queue.
 *
 * Security — who may invoke:
 * 1. Vercel Cron (`x-vercel-cron: 1`)
 * 2. Scheduler worker script (`x-scheduler-worker: true`)
 * 3. Development (`NODE_ENV === 'development'`) — GET only in dev; POST in dev for manual testing
 *
 * Any signed-in user must NOT trigger global queue processing (all tenants).
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'POST' }
    })
  }
  return POST(request)
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? undefined
  const log = createLogger({ requestId, service: 'api/scheduler/dispatch' })
  const cronHeader = request.headers.get('x-vercel-cron')
  const workerHeader = request.headers.get('x-scheduler-worker')
  const isVercelCron = cronHeader === '1'
  const isSchedulerWorker = workerHeader === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'

  const authorized = isDevelopment || isVercelCron || isSchedulerWorker

  if (!authorized) {
    return NextResponse.json({
      success: false,
      error:
        'Unauthorized: This endpoint can only be called by Vercel Cron, the scheduler worker, or in development'
    }, { status: 403 })
  }

  try {
    const result = await processQueue()
    log.info({ processed: result.processed }, 'Dispatch completed')
    return NextResponse.json({
      success: true,
      processed: result.processed,
      results: result.results
    })
  } catch (error: any) {
    log.error({ err: error }, 'Dispatch failed')
    return NextResponse.json({
      success: false,
      error: 'Dispatch failed',
      details: error.message
    }, { status: 500 })
  }
}


