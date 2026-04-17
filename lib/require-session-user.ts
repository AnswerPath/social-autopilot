import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'

/**
 * Resolve the authenticated user for API routes. Returns 401 JSON if missing.
 */
export async function requireSessionUserId(
  request: NextRequest
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const user = await getCurrentUser(request)
  if (!user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }
  return { ok: true, userId: user.id }
}
