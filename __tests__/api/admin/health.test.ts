/**
 * Unit tests for /api/admin/health route
 */
import { NextRequest } from 'next/server';
import { UserRole } from '@/lib/auth-types';

jest.mock('@/lib/auth-utils', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/database-storage', () => ({
  getDatabaseHealth: jest.fn(),
}));

jest.mock('@/lib/error-handling', () => ({
  ErrorMonitor: {
    getInstance: jest.fn(() => ({
      getErrorStats: jest.fn(() => ({ 'x-api-rate_limit': 0 })),
    })),
  },
}));

describe('Admin Health API', () => {
  const getCurrentUser = require('@/lib/auth-utils').getCurrentUser;
  const getDatabaseHealth = require('@/lib/database-storage').getDatabaseHealth;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user is not admin', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: UserRole.EDITOR,
    });

    const { GET } = await import('@/app/api/admin/health/route');
    const request = new NextRequest('http://localhost:3000/api/admin/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(getDatabaseHealth).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not authenticated', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/health/route');
    const request = new NextRequest('http://localhost:3000/api/admin/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns health data when user is admin', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ADMIN,
    });
    (getDatabaseHealth as jest.Mock).mockResolvedValue({
      success: true,
      tableExists: true,
      canRead: true,
      canWrite: true,
      recordCount: 42,
    });

    const { GET } = await import('@/app/api/admin/health/route');
    const request = new NextRequest('http://localhost:3000/api/admin/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.db).toEqual({
      success: true,
      tableExists: true,
      canRead: true,
      canWrite: true,
      recordCount: 42,
    });
    expect(data.stats).toBeDefined();
    expect(data.circuitBreaker).toBeDefined();
  });

  it('returns partial health when database check fails', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      role: UserRole.ADMIN,
    });
    (getDatabaseHealth as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('@/app/api/admin/health/route');
    const request = new NextRequest('http://localhost:3000/api/admin/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.db).toMatchObject({
      success: false,
      error: 'Connection refused',
    });
    expect(data.stats).toBeDefined();
  });
});
