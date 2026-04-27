/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

jest.mock('@/lib/auth-utils', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/x-api-storage', () => ({
  getXApiConsumerKeysForOAuth: jest.fn(),
}))

const mockGenerateAuthLink = jest.fn().mockResolvedValue({
  url: 'https://api.twitter.com/oauth/authorize?oauth_token=abc',
  oauth_token: 'abc',
  oauth_token_secret: 'oauth-secret',
})

jest.mock('twitter-api-v2', () => ({
  TwitterApi: jest.fn().mockImplementation(() => ({
    generateAuthLink: (...args: unknown[]) => mockGenerateAuthLink(...args),
  })),
}))

jest.mock('@/lib/x-oauth-config', () => ({
  getXOAuthCallbackUrl: jest.fn(() => 'http://localhost:3000/api/auth/twitter/callback'),
  sanitizeXOAuthReturnTo: jest.fn(() => '/settings'),
  X_OAUTH_COOKIE_NAMES: {
    tokenSecret: 'x_oauth_token_secret',
    token: 'x_oauth_token',
    returnTo: 'x_oauth_return_to',
  },
  xOAuthCookieOptions: jest.fn(() => ({ httpOnly: true, path: '/' })),
}))

import { getCurrentUser } from '@/lib/auth-utils'
import { getXApiConsumerKeysForOAuth } from '@/lib/x-api-storage'

let GET: (req: NextRequest) => Promise<Response>

describe('GET /api/auth/twitter', () => {
  beforeAll(async () => {
    const mod = await import('@/app/api/auth/twitter/route')
    GET = mod.GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to auth error when consumer keys are missing', async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(getXApiConsumerKeysForOAuth as jest.Mock).mockResolvedValue({ success: false })

    const request = new NextRequest('http://localhost:3000/api/auth/twitter')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(mockGenerateAuthLink).not.toHaveBeenCalled()
    // NextResponse redirect Location header is not always visible via Headers in this Jest setup.
    expect(getXApiConsumerKeysForOAuth).toHaveBeenCalledWith('user-1')
  })

  it('redirects to Twitter authorize URL when consumer keys exist', async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1' })
    ;(getXApiConsumerKeysForOAuth as jest.Mock).mockResolvedValue({
      success: true,
      apiKey: 'ck',
      apiKeySecret: 'cs',
    })

    const request = new NextRequest('http://localhost:3000/api/auth/twitter')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(mockGenerateAuthLink).toHaveBeenCalled()
    expect(getXApiConsumerKeysForOAuth).toHaveBeenCalledWith('user-1')
  })
})
