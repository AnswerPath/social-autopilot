import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { CircuitBreakerRegistry } from '@/lib/error-handling';

export const runtime = 'nodejs';

/**
 * Admin-only: Reset all registered circuit breakers to CLOSED state.
 * Allows recovery from OPEN circuit without restarting the app.
 * Auth: Admin session or Authorization: Bearer <ADMIN_RECOVERY_TOKEN>
 */
export async function POST(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const registry = CircuitBreakerRegistry.getInstance();
    const count = registry.resetAll();
    return NextResponse.json({
      success: true,
      message: `Reset ${count} circuit breaker(s)`,
      resetCount: count,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
