import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/admin-auth';
import { CircuitBreakerRegistry } from '@/lib/error-handling';
import { createLogger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * Admin-only: Reset all registered circuit breakers to CLOSED state.
 * Allows recovery from OPEN circuit without restarting the app.
 * Auth: Admin session or Authorization: Bearer <ADMIN_RECOVERY_TOKEN>
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminIdentity(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const log = createLogger({
    requestId,
    service: 'api/admin/recovery/circuit-breaker-reset',
    userId: admin.id,
  });
  log.info(
    { event: 'admin.circuit_breaker_reset.request', adminId: admin.id, adminEmail: admin.email },
    'admin.circuit_breaker_reset.request'
  );
  try {
    const registry = CircuitBreakerRegistry.getInstance();
    const count = registry.resetAll();
    log.info(
      { event: 'admin.circuit_breaker_reset.success', adminId: admin.id, adminEmail: admin.email, resetCount: count },
      'admin.circuit_breaker_reset.success'
    );
    return NextResponse.json({
      success: true,
      message: `Reset ${count} circuit breaker(s)`,
      resetCount: count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    log.warn(
      { event: 'admin.circuit_breaker_reset.error', adminId: admin.id, adminEmail: admin.email, error: message },
      'admin.circuit_breaker_reset.error'
    );
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
