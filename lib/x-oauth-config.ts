/**
 * OAuth 1.0a redirect helpers for X (Twitter) user-context flow.
 */

const ALLOWED_RETURN_PREFIXES = ['/settings', '/account-settings', '/onboarding'] as const;

export function getXOAuthAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function getXOAuthCallbackUrl(): string {
  return `${getXOAuthAppBaseUrl()}/api/auth/twitter/callback`;
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
