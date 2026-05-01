/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/auth/twitter/callback-url/route'

describe('GET /api/auth/twitter/callback-url', () => {
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalNextAuthUrl = process.env.NEXTAUTH_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
    process.env.NEXTAUTH_URL = originalNextAuthUrl
  })

  it('returns the server-resolved callback URL used by X OAuth', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://social.example.com'
    delete process.env.NEXTAUTH_URL

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/twitter/callback-url')
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      appOrigin: 'https://social.example.com',
      callbackUrl: 'https://social.example.com/api/auth/twitter/callback',
    })
  })
})
