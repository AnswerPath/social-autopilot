import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

const RETRY_ALL_LIMIT = 100;

/**
 * Admin-only: Retry failed jobs by resetting status to approved and clearing retry state.
 * Body: { jobIds?: string[], retryAll?: boolean }
 * - jobIds: retry specific failed jobs
 * - retryAll: retry all failed jobs (up to RETRY_ALL_LIMIT)
 * Auth: Admin session or Authorization: Bearer <ADMIN_RECOVERY_TOKEN>
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminIdentity(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const log = createLogger({ requestId, service: 'api/admin/jobs/retry', userId: admin.id });
  try {
    const body = await request.json().catch(() => ({}));
    const { jobIds, retryAll } = body;

    log.info(
      { event: 'admin.retry_jobs.request', adminId: admin.id, adminEmail: admin.email, jobIds, retryAll },
      'admin.retry_jobs.request'
    );

    const now = new Date().toISOString();
    const updatePayload = {
      status: 'approved',
      retry_count: 0,
      scheduled_at: now,
      error: null,
    };

    if (jobIds && Array.isArray(jobIds) && jobIds.length > 0) {
      // Retry specific jobs
      const { data, error } = await supabaseAdmin
        .from('scheduled_posts')
        .update(updatePayload)
        .eq('status', 'failed')
        .in('id', jobIds)
        .select('id');

      if (error) {
        log.warn(
          { event: 'admin.retry_jobs.error', adminId: admin.id, adminEmail: admin.email, error: error.message },
          'admin.retry_jobs.error'
        );
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      const queuedCount = data?.length ?? 0;
      log.info(
        { event: 'admin.retry_jobs.success', adminId: admin.id, adminEmail: admin.email, queuedCount },
        'admin.retry_jobs.success'
      );
      return NextResponse.json({
        success: true,
        message: `Queued ${queuedCount} job(s) for retry`,
        retryCount: queuedCount,
      });
    }

    if (retryAll) {
      // Retry all failed jobs (with limit)
      const { data: failedJobs } = await supabaseAdmin
        .from('scheduled_posts')
        .select('id')
        .eq('status', 'failed')
        .limit(RETRY_ALL_LIMIT);

      if (!failedJobs || failedJobs.length === 0) {
        log.info(
          { event: 'admin.retry_jobs.success', adminId: admin.id, adminEmail: admin.email, queuedCount: 0 },
          'admin.retry_jobs.success'
        );
        return NextResponse.json({
          success: true,
          message: 'No failed jobs to retry',
          retryCount: 0,
        });
      }

      const ids = failedJobs.map((j) => j.id);
      const { error } = await supabaseAdmin
        .from('scheduled_posts')
        .update(updatePayload)
        .eq('status', 'failed')
        .in('id', ids);

      if (error) {
        log.warn(
          { event: 'admin.retry_jobs.error', adminId: admin.id, adminEmail: admin.email, error: error.message },
          'admin.retry_jobs.error'
        );
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      log.info(
        { event: 'admin.retry_jobs.success', adminId: admin.id, adminEmail: admin.email, queuedCount: ids.length },
        'admin.retry_jobs.success'
      );
      return NextResponse.json({
        success: true,
        message: `Queued ${ids.length} job(s) for retry`,
        retryCount: ids.length,
      });
    }

    return NextResponse.json(
      { error: 'Provide jobIds (array) or retryAll (true) in request body' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    log.warn(
      { event: 'admin.retry_jobs.error', adminId: admin.id, adminEmail: admin.email, error: message },
      'admin.retry_jobs.error'
    );
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
