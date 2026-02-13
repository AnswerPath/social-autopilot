import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { UserRole } from '@/lib/auth-types';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const RETRY_ALL_LIMIT = 100;

function isAdmin(request: NextRequest): Promise<boolean> {
  return (async () => {
    const authHeader = request.headers.get('authorization');
    const token = process.env.ADMIN_RECOVERY_TOKEN;
    if (token && authHeader?.startsWith('Bearer ') && authHeader.slice(7) === token) {
      return true;
    }
    const user = await getCurrentUser(request);
    return !!(user && user.role === UserRole.ADMIN);
  })();
}

/**
 * Admin-only: Retry failed jobs by resetting status to approved and clearing retry state.
 * Body: { jobIds?: string[], retryAll?: boolean }
 * - jobIds: retry specific failed jobs
 * - retryAll: retry all failed jobs (up to RETRY_ALL_LIMIT)
 * Auth: Admin session or Authorization: Bearer <ADMIN_RECOVERY_TOKEN>
 */
export async function POST(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { jobIds, retryAll } = body;

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
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Queued ${data?.length ?? 0} job(s) for retry`,
        retryCount: data?.length ?? 0,
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
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
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
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
