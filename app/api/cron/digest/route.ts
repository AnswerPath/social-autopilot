import { NextRequest, NextResponse } from 'next/server'
import { runDigestJob } from '@/lib/notifications/digest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Digest cron: runs daily and weekly notification digests.
 * Secured by x-vercel-cron (Vercel) or NODE_ENV=development.
 */
export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron')
  const isVercelCron = cronHeader === '1'
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && !isVercelCron) {
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
