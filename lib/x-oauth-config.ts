/**
 * OAuth 1.0a redirect helpers for X (Twitter) user-context flow.
 */

import type { NextRequest } from 'next/server';

const ALLOWED_RETURN_PREFIXES = ['/settings', '/account-settings', '/onboarding'] as const;

/** Trimmed env base URL, or null if unset / not an absolute http(s) URL. */
function readPreferredOAuthAppBase(): string | null {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Base URL from env (for non-request code paths). Falls back to localhost in dev only.
 */
export function getXOAuthAppBaseUrl(): string {
  return readPreferredOAuthAppBase() ?? 'http://localhost:3000';
}

/**
 * Absolute origin for redirects and callback URLs. Prefer env (must match X app callback);
 * otherwise use the incoming request origin so NextResponse.redirect always gets absolute URLs.
 */
export function resolveXOAuthAppOrigin(request: NextRequest): string {
  return readPreferredOAuthAppBase() ?? request.nextUrl.origin.replace(/\/$/, '');
}

export function getXOAuthCallbackUrl(request?: NextRequest): string {
  const base = request ? resolveXOAuthAppOrigin(request) : getXOAuthAppBaseUrl();
  return `${base}/api/auth/twitter/callback`;
}

/**
 * Safe relative path for post-OAuth redirect (open-redirect hardening).
 */
export function sanitizeXOAuthReturnTo(raw: string | null): string {
  const fallback = '/account-settings';
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('://')) return fallback;
  const isAllowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}/`) || trimmed.startsWith(`${prefix}?`)
  );
  return isAllowed ? trimmed : fallback;
}

export function appendXOAuthError(returnTo: string, error: string): string {
  const separator = returnTo.includes('?') ? '&' : '?';
  return `${returnTo}${separator}x_error=${encodeURIComponent(error)}`;
}

export const X_OAUTH_COOKIE_NAMES = {
  tokenSecret: 'x_oauth_token_secret',
  token: 'x_oauth_token',
  returnTo: 'x_oauth_return_to',
} as const;

export function xOAuthCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth/twitter',
    maxAge: maxAgeSeconds,
  };
}
