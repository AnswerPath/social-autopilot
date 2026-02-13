import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { UserRole } from '@/lib/auth-types';
import { CircuitBreakerRegistry } from '@/lib/error-handling';

export const runtime = 'nodejs';

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
