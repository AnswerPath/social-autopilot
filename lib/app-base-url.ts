/**
 * Canonical app base URL for redirects (auth reset, verification, invites).
 * Trailing slashes are stripped.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  return raw.replace(/\/$/, '')
}
