/**
 * @jest-environment node
 */

import { appendXOAuthError, resolveXOAuthAppOrigin } from '@/lib/x-oauth-config'

describe('resolveXOAuthAppOrigin', () => {
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalNextAuthUrl = process.env.NEXTAUTH_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    process.env.NEXTAUTH_URL = originalNextAuthUrl
  })

  it('falls back to the request origin when the configured app URL is malformed', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://[invalid'
    delete process.env.NEXTAUTH_URL

    const origin = resolveXOAuthAppOrigin({
      nextUrl: { origin: 'https://v0-social-autopilot.vercel.app' },
    } as Parameters<typeof resolveXOAuthAppOrigin>[0])

    expect(origin).toBe('https://v0-social-autopilot.vercel.app')
  })

  it('appends OAuth errors to return paths with or without existing query params', () => {
    expect(appendXOAuthError('/onboarding', 'denied')).toBe('/onboarding?x_error=denied')
    expect(appendXOAuthError('/onboarding?step=connect', 'missing_oauth_params')).toBe(
      '/onboarding?step=connect&x_error=missing_oauth_params'
    )
  })
})
