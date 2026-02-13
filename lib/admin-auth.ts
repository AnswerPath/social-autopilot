import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { UserRole } from '@/lib/auth-types';

export type AdminIdentity = { id: string; email: string };

/**
 * Resolve admin identity from request (Bearer token or admin session).
 * Returns identity for logging; use isAdmin() when only a boolean is needed.
 */
export async function getAdminIdentity(request: NextRequest): Promise<AdminIdentity | null> {
  const authHeader = request.headers.get('authorization');
  const token = process.env.ADMIN_RECOVERY_TOKEN;
  if (token && authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader?.slice(7) ?? '';
    const a = Buffer.from(bearer, 'utf8');
    const b = Buffer.from(token, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { id: 'recovery-token', email: 'recovery-token' };
    }
  }
  const user = await getCurrentUser(request);
  if (!user || user.role !== UserRole.ADMIN) return null;
  return { id: user.id, email: user.email ?? '' };
}

/**
 * Check if the request is authorized as admin via Bearer token or session.
 * - Authorization: Bearer <ADMIN_RECOVERY_TOKEN> (env), compared with timing-safe equality
 * - Or current user has role UserRole.ADMIN
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  return (await getAdminIdentity(request)) !== null;
}
