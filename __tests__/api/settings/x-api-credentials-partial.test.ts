/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/settings/x-api-credentials/route'

jest.mock('@/lib/auth-utils', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({ id: 'test-user' }),
  createAuthError: jest.fn((type: string, msg: string) => ({ type, message: msg })),
}))

jest.mock('@/lib/x-api-storage', () => ({
  getXApiCredentialsMetadata: jest.fn(),
  deleteXApiCredentials: jest.fn(),
  updateXApiCredentials: jest.fn(),
  cleanupDemoMentions: jest.fn(),
  storeXApiConsumerCredentials: jest.fn(),
  clearXApiAccessTokens: jest.fn(),
  validateXApiCredentials: jest.fn(),
}))

jest.mock('@/lib/unified-credentials', () => ({
  storeUnifiedCredentials: jest.fn(),
}))

jest.mock('@/lib/database-storage', () => ({
  deleteTwitterCredentials: jest.fn(),
}))

jest.mock('@/app/api/mentions/stream/route', () => ({
  activeMonitors: new Map(),
}))

describe('POST /api/settings/x-api-credentials — partial access token pair', () => {
  it('returns 400 when only accessToken is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/settings/x-api-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'k',
        apiKeySecret: 's',
        accessToken: 'only-token',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/accessToken/)
  })

  it('returns 400 when only accessTokenSecret is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/settings/x-api-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'k',
        apiKeySecret: 's',
        accessTokenSecret: 'only-secret',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
