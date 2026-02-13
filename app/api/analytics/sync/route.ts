import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAnalyticsSyncScheduler } from '@/lib/analytics/analytics-sync-scheduler';
import { createLogger } from '@/lib/logger';
import { isEnabled } from '@/lib/feature-flags';

const SYNC_TIMEOUT_MS = 90_000; // 90 seconds

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync timeout')), ms)
    ),
  ]);
}

/**
 * POST /api/analytics/sync
 * Trigger analytics sync for a user
 * 
 * Body: {
 *   userId: string,
 *   syncType: 'posts' | 'followers' | 'both',
 *   options?: {
 *     days?: number,      // Fetch tweets from last N days (default: 7)
 *     syncAll?: boolean   // Fetch ALL user tweets (may take longer, respects rate limits)
 *   }
 * }
 * 
 * Note: Post sync always fetches from X API user timeline, not from scheduled_posts
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const log = createLogger({ requestId, service: 'api/analytics/sync' });
  try {
    const body = await request.json();
    const { userId, syncType = 'both', options } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!['posts', 'followers', 'both'].includes(syncType)) {
      return NextResponse.json(
        { success: false, error: 'syncType must be "posts", "followers", or "both"' },
        { status: 400 }
      );
    }

    const useV2 = isEnabled('analytics_sync_v2', { userId });
    if (useV2) log.info({ userId }, 'Analytics sync v2 flag enabled');
    const scheduler = createAnalyticsSyncScheduler();
    const result = await withTimeout(
      scheduler.syncUserAnalytics(
        userId,
        syncType === 'posts' ? 'post_analytics' : syncType === 'followers' ? 'follower_analytics' : 'both',
        { ...options, useV2 }
      ),
      SYNC_TIMEOUT_MS
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      message: 'Analytics sync started',
      postsProcessed: result.postsProcessed,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === 'Sync timeout';
    if (isTimeout) {
      log.warn('Analytics sync timeout');
      Sentry.captureMessage('Analytics sync timeout', 'warning');
      return NextResponse.json(
        {
          success: false,
          error: 'Request timed out. Please try again or use a smaller date range.',
        },
        { status: 503 }
      );
    }
    log.error({ err: error }, 'Error in POST /api/analytics/sync');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start analytics sync',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/sync
 * Get sync job status/history
 * 
 * Query params:
 *   userId: string (required)
 *   jobId?: string (optional, to get specific job)
 *   status?: string (optional, filter by status)
 *   limit?: number (optional, default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const jobId = searchParams.get('jobId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const scheduler = createAnalyticsSyncScheduler();

    if (jobId) {
      // Get specific job
      const job = await scheduler.getJobStatus(jobId);
      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Job not found' },
          { status: 404 }
        );
      }

      // Verify job belongs to user
      if (job.user_id !== userId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        job,
      });
    } else {
      // Get job history
      const jobs = await scheduler.getJobHistory(userId, limit);

      // Filter by status if provided
      const filteredJobs = status
        ? jobs.filter((job: any) => job.status === status)
        : jobs;

      return NextResponse.json({
        success: true,
        jobs: filteredJobs,
        count: filteredJobs.length,
      });
    }
  } catch (error) {
    console.error('Error in GET /api/analytics/sync:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get sync status' 
      },
      { status: 500 }
    );
  }
}
