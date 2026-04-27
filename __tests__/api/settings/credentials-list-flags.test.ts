/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/settings/credentials-list/route'

jest.mock('@/lib/require-session-user', () => ({
  requireSessionUserId: jest.fn(),
}))

jest.mock('@/lib/database-storage', () => ({
  listUserCredentials: jest.fn(),
}))

jest.mock('@/lib/x-api-storage', () => ({
  getXApiCredentialsMetadata: jest.fn(),
}))

import { requireSessionUserId } from '@/lib/require-session-user'
import { listUserCredentials } from '@/lib/database-storage'
import { getXApiCredentialsMetadata } from '@/lib/x-api-storage'

describe('GET /api/settings/credentials-list — X API flags', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireSessionUserId as jest.Mock).mockResolvedValue({ ok: true, userId: 'u1' })
  })

  it('exposes has_xapi_row, is_xapi_valid, pending_oauth from metadata', async () => {
    ;(listUserCredentials as jest.Mock).mockResolvedValue({
      success: true,
      credentials: [{ id: '1', credential_type: 'x-api', is_valid: true, created_at: new Date().toISOString() }],
    })
    ;(getXApiCredentialsMetadata as jest.Mock).mockResolvedValue({
      success: true,
      metadata: {
        hasRow: true,
        isValid: false,
        hasConsumerKeys: true,
        hasAccessTokens: false,
      },
    })

    const request = new NextRequest('http://localhost:3000/api/settings/credentials-list')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.has_xapi_row).toBe(true)
    expect(data.is_xapi_valid).toBe(false)
    expect(data.pending_oauth).toBe(true)
  })

  it('sets pending_oauth false when access tokens exist', async () => {
    ;(listUserCredentials as jest.Mock).mockResolvedValue({
      success: true,
      credentials: [{ id: '1', credential_type: 'x-api', is_valid: true, created_at: new Date().toISOString() }],
    })
    ;(getXApiCredentialsMetadata as jest.Mock).mockResolvedValue({
      success: true,
      metadata: {
        hasRow: true,
        isValid: true,
        hasConsumerKeys: true,
        hasAccessTokens: true,
      },
    })

    const request = new NextRequest('http://localhost:3000/api/settings/credentials-list')
    const response = await GET(request)
    const data = await response.json()

    expect(data.is_xapi_valid).toBe(true)
    expect(data.pending_oauth).toBe(false)
  })
})
