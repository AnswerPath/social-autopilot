/**
 * @jest-environment node
 */

import { resolveXOAuthAppOrigin } from '@/lib/x-oauth-config'

describe('Twitter OAuth callback route', () => {
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
})
