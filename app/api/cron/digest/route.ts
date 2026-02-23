import { NextRequest, NextResponse } from 'next/server'
import { runDigestJob } from '@/lib/notifications/digest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Digest cron: runs daily and weekly notification digests.
 * Secured by CRON_SECRET Bearer token or NODE_ENV=development.
 */
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isDev && !isValidCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind') ?? 'daily'
  if (kind !== 'daily' && kind !== 'weekly') {
    return NextResponse.json({ error: 'Invalid kind. Use daily or weekly.' }, { status: 400 })
  }

  try {
    const result = await runDigestJob(kind)
    return NextResponse.json({
      success: true,
      kind,
      usersProcessed: result.usersProcessed,
      errors: result.errors.length > 0 ? result.errors : undefined
    })
  } catch (err) {
    console.error('[cron/digest] failed', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Digest job failed' },
      { status: 500 }
    )
  }
}
