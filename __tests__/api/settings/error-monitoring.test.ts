/**
 * Unit tests for /api/settings/error-monitoring route
 */
import { NextRequest } from 'next/server';

jest.mock('@/lib/error-handling', () => ({
  ErrorMonitor: {
    getInstance: jest.fn(() => ({
      getErrorStats: jest.fn(() => ({ 'x-api-rate_limit': 1 })),
      resetCounts: jest.fn(),
      recordError: jest.fn(),
    })),
  },
  ApiErrorHandler: {
    createError: jest.fn((type: string, message: string, service: string) => ({
      type,
      message,
      service,
    })),
  },
  ErrorType: {},
}));

describe('Error Monitoring API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('returns stats when action=stats', async () => {
      const { GET } = await import('@/app/api/settings/error-monitoring/route');
      const request = new NextRequest(
        'http://localhost:3000/api/settings/error-monitoring?action=stats'
      );
      const response = await GET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stats).toBeDefined();
    });

    it('returns success when action=reset', async () => {
      const { GET } = await import('@/app/api/settings/error-monitoring/route');
      const request = new NextRequest(
        'http://localhost:3000/api/settings/error-monitoring?action=reset'
      );
      const response = await GET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('reset');
    });

    it('returns health stats when action=health', async () => {
      const { GET } = await import('@/app/api/settings/error-monitoring/route');
      const request = new NextRequest(
        'http://localhost:3000/api/settings/error-monitoring?action=health'
      );
      const response = await GET(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stats).toBeDefined();
      expect(data.circuitBreaker).toBeDefined();
    });

    it('returns 400 for invalid action', async () => {
      const { GET } = await import('@/app/api/settings/error-monitoring/route');
      const request = new NextRequest(
        'http://localhost:3000/api/settings/error-monitoring?action=invalid'
      );
      const response = await GET(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });

  describe('POST', () => {
    it('records error and returns 200', async () => {
      const { POST } = await import('@/app/api/settings/error-monitoring/route');
      const request = new NextRequest(
        'http://localhost:3000/api/settings/error-monitoring',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            errorType: 'server_error',
            message: 'Test error',
            service: 'x-api',
            endpoint: 'test',
            userId: 'u1',
          }),
        }
      );
      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.error).toBeDefined();
    });
  });
});
