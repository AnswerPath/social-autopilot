import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { UserRole } from '@/lib/auth-types';
import { getDatabaseHealth } from '@/lib/database-storage';
import { ErrorMonitor } from '@/lib/error-handling';

export const runtime = 'nodejs';

/**
 * Admin-only health summary: DB status, error stats, circuit breaker note.
 * Used by the admin health dashboard.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const [dbHealth, errorStats] = await Promise.all([
      getDatabaseHealth().catch((e) => ({
        success: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        recordCount: 0,
        error: e instanceof Error ? e.message : 'Unknown',
      })),
      Promise.resolve(ErrorMonitor.getInstance().getErrorStats()),
    ]);
    return NextResponse.json({
      success: true,
      db: dbHealth,
      stats: errorStats,
      circuitBreaker: {
        note: 'Circuit breaker state is per X API / Apify client instance; not aggregated here.',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
