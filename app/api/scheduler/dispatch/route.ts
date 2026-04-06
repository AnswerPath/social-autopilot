import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/job-queue'
import { createLogger } from '@/lib/logger'
import { getCurrentUser } from '@/lib/auth-utils'

export const runtime = 'nodejs'

/**
 * Process the scheduled posts queue.
 *
 * Security — who may invoke:
 * 1. Vercel Cron (`x-vercel-cron: 1`)
 * 2. Scheduler worker script (`x-scheduler-worker: true`)
 * 3. Authenticated app users (same session cookies as the rest of the app; used by calendar polling)
 * 4. Development (`NODE_ENV === 'development'`) for local manual testing
 *
 * GET/POST both run the same handler (GET for manual testing in dev).
 */
export async function GET(request: NextRequest) {
  // Allow GET for manual testing
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

  let authorized =
    isDevelopment || isVercelCron || isSchedulerWorker

  if (!authorized) {
    const user = await getCurrentUser(request)
    authorized = user != null
  }

  if (!authorized) {
    return NextResponse.json({
      success: false,
      error:
        'Unauthorized: This endpoint can only be called by Vercel Cron, the scheduler worker, or a signed-in user'
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


