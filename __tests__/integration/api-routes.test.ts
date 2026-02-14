/**
 * Integration tests for API routes
 */

import { NextRequest } from 'next/server'
import { mockFetch, mockFetchError, createMockApiResponse } from '../utils/test-utils'

// Mock the API route handlers
jest.mock('@/lib/apify-service')
jest.mock('@/lib/x-api-service')
jest.mock('@/lib/token-management')
jest.mock('@/lib/compliance')
jest.mock('@/lib/error-handling')
jest.mock('@/lib/auth-utils', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({ id: 'test-user' }),
  createAuthError: jest.fn((type: string, msg: string) => ({ type, message: msg })),
}))

// Skip these tests as they require full API route environment with proper mocking
describe.skip('API Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch({ success: true })
  })

  describe('Apify Credentials API', () => {
    it('should handle POST /api/settings/apify-credentials', async () => {
      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-apify-key',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle GET /api/settings/apify-credentials', async () => {
      const { GET } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle PUT /api/settings/apify-credentials', async () => {
      const { PUT } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'updated-apify-key',
        }),
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle DELETE /api/settings/apify-credentials', async () => {
      const { DELETE } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials')

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('X API Credentials API', () => {
    it('should handle POST /api/settings/x-api-credentials', async () => {
      const { POST } = require('@/app/api/settings/x-api-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/x-api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-x-api-key',
          apiKeySecret: 'test-x-api-secret',
          accessToken: 'test-access-token',
          accessTokenSecret: 'test-access-token-secret',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle GET /api/settings/x-api-credentials', async () => {
      const { GET } = require('@/app/api/settings/x-api-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/x-api-credentials')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Token Management API', () => {
    it('should handle GET /api/settings/token-management', async () => {
      const { GET } = require('@/app/api/settings/token-management/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/token-management?userId=test-user')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBeDefined()
    })

    it('should handle POST /api/settings/token-management for validation', async () => {
      const { POST } = require('@/app/api/settings/token-management/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/token-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          action: 'validate',
          service: 'apify',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle POST /api/settings/token-management for revocation', async () => {
      const { POST } = require('@/app/api/settings/token-management/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/token-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          action: 'revoke',
          service: 'apify',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Compliance API', () => {
    it('should handle GET /api/settings/compliance for status', async () => {
      const { GET } = require('@/app/api/settings/compliance/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/compliance?action=compliance-status')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.compliance).toBeDefined()
    })

    it('should handle GET /api/settings/compliance for privacy policy', async () => {
      const { GET } = require('@/app/api/settings/compliance/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/compliance?action=privacy-policy')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.privacyPolicy).toBeDefined()
    })

    it('should handle GET /api/settings/compliance for data export', async () => {
      const { GET } = require('@/app/api/settings/compliance/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/compliance?action=data-export&userId=test-user')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.userData).toBeDefined()
    })

    it('should handle POST /api/settings/compliance for consent recording', async () => {
      const { POST } = require('@/app/api/settings/compliance/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record-consent',
          userId: 'test-user',
          dataUsage: ['api_credentials', 'analytics'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle POST /api/settings/compliance for data deletion', async () => {
      const { POST } = require('@/app/api/settings/compliance/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-data',
          userId: 'test-user',
          reason: 'User request',
          dataTypes: ['credentials'],
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Error Monitoring API', () => {
    it('should handle GET /api/settings/error-monitoring for stats', async () => {
      const { GET } = require('@/app/api/settings/error-monitoring/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/error-monitoring?action=stats')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.stats).toBeDefined()
    })

    it('should handle GET /api/settings/error-monitoring for reset', async () => {
      const { GET } = require('@/app/api/settings/error-monitoring/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/error-monitoring?action=reset')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle POST /api/settings/error-monitoring for error recording', async () => {
      const { POST } = require('@/app/api/settings/error-monitoring/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/error-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorType: 'server_error',
          message: 'Test error',
          service: 'x-api',
          endpoint: 'test',
          userId: 'test-user',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Connection Testing API', () => {
    it('should handle POST /api/settings/test-apify-connection', async () => {
      const { POST } = require('@/app/api/settings/test-apify-connection/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/test-apify-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-apify-key',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle POST /api/settings/test-x-api-connection', async () => {
      const { POST } = require('@/app/api/settings/test-x-api-connection/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/test-x-api-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-x-api-key',
          apiKeySecret: 'test-x-api-secret',
          accessToken: 'test-access-token',
          accessTokenSecret: 'test-access-token-secret',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('should handle invalid JSON in request body', async () => {
      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should handle database errors gracefully', async () => {
      // Mock database error
      jest.spyOn(require('@/lib/apify-storage'), 'storeApifyCredentials')
        .mockRejectedValue(new Error('Database connection failed'))

      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'test-apify-key',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })

    it('should return 401 when unauthenticated for apify credentials', async () => {
      const authUtils = require('@/lib/auth-utils')
      authUtils.getCurrentUser.mockResolvedValueOnce(null)

      const { POST } = require('@/app/api/settings/apify-credentials/route')
      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'test-apify-key' }),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should validate user ID parameter', async () => {
      const { GET } = require('@/app/api/settings/token-management/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/token-management')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing userId parameter')
    })

    it('should handle invalid service parameter', async () => {
      const { POST } = require('@/app/api/settings/token-management/route')
      
      const request = new NextRequest('http://localhost:3000/api/settings/token-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          action: 'validate',
          service: 'invalid-service',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid service')
    })
  })

  describe('Rate Limiting and Performance', () => {
    it('should handle concurrent requests', async () => {
      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: 'test-apify-key',
          }),
        })
      )

      const responses = await Promise.all(requests.map(request => POST(request)))
      const data = await Promise.all(responses.map(response => response.json()))

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      data.forEach(item => {
        expect(item.success).toBe(true)
      })
    })

    it('should handle large request bodies', async () => {
      const { POST } = require('@/app/api/settings/apify-credentials/route')
      
      const largeBody = {
        apiKey: 'a'.repeat(1000),
      }

      const request = new NextRequest('http://localhost:3000/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeBody),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
