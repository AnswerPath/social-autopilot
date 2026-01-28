/**
 * Integration tests for analytics sync API endpoint
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/analytics/sync/route';
import { createAnalyticsSyncScheduler } from '@/lib/analytics/analytics-sync-scheduler';
import { supabaseAdmin } from '@/lib/supabase';

// Mock dependencies
jest.mock('@/lib/analytics/analytics-sync-scheduler');
jest.mock('@/lib/supabase');

const mockCreateAnalyticsSyncScheduler = createAnalyticsSyncScheduler as jest.MockedFunction<typeof createAnalyticsSyncScheduler>;
const mockSupabaseAdmin = supabaseAdmin as jest.Mocked<any>;

describe('Analytics Sync API', () => {
  let mockScheduler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockScheduler = {
      syncUserAnalytics: jest.fn(),
      getJobStatus: jest.fn(),
      getJobHistory: jest.fn(),
    };

    mockCreateAnalyticsSyncScheduler.mockReturnValue(mockScheduler);

    // Mock supabase for job creation
    mockSupabaseAdmin.from = jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'job-123', user_id: 'test-user', status: 'running' },
        error: null,
      }),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });
  });

  describe('POST /api/analytics/sync', () => {
    it('should trigger sync with valid request', async () => {
      mockScheduler.syncUserAnalytics.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        postsProcessed: 10,
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'both',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobId).toBe('job-123');
      expect(data.postsProcessed).toBe(10);
      expect(mockScheduler.syncUserAnalytics).toHaveBeenCalledWith(
        'test-user',
        'both',
        undefined
      );
    });

    it('should trigger post analytics sync', async () => {
      mockScheduler.syncUserAnalytics.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        postsProcessed: 5,
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'posts',
          options: { days: 7 },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockScheduler.syncUserAnalytics).toHaveBeenCalledWith(
        'test-user',
        'post_analytics',
        { days: 7 }
      );
    });

    it('should trigger follower analytics sync', async () => {
      mockScheduler.syncUserAnalytics.mockResolvedValue({
        success: true,
        jobId: 'job-123',
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'followers',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockScheduler.syncUserAnalytics).toHaveBeenCalledWith(
        'test-user',
        'follower_analytics',
        undefined
      );
    });

    it('should support syncAll option', async () => {
      mockScheduler.syncUserAnalytics.mockResolvedValue({
        success: true,
        jobId: 'job-123',
        postsProcessed: 100,
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'posts',
          options: { syncAll: true },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockScheduler.syncUserAnalytics).toHaveBeenCalledWith(
        'test-user',
        'post_analytics',
        { syncAll: true }
      );
    });

    it('should return 400 when userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncType: 'both',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('userId is required');
    });

    it('should return 400 when syncType is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'invalid',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('syncType');
    });

    it('should handle sync errors', async () => {
      mockScheduler.syncUserAnalytics.mockResolvedValue({
        success: false,
        error: 'Sync failed',
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'both',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Sync failed');
    });

    it('should handle exceptions', async () => {
      mockScheduler.syncUserAnalytics.mockRejectedValue(new Error('Unexpected error'));

      const request = new NextRequest('http://localhost:3000/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          syncType: 'both',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unexpected error');
    });
  });

  describe('GET /api/analytics/sync', () => {
    it('should get specific job status', async () => {
      mockScheduler.getJobStatus.mockResolvedValue({
        id: 'job-123',
        user_id: 'test-user',
        status: 'completed',
        posts_processed: 10,
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user&jobId=job-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.job.id).toBe('job-123');
      expect(data.job.status).toBe('completed');
      expect(mockScheduler.getJobStatus).toHaveBeenCalledWith('job-123');
    });

    it('should return 404 when job not found', async () => {
      mockScheduler.getJobStatus.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user&jobId=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Job not found');
    });

    it('should return 403 when job belongs to different user', async () => {
      mockScheduler.getJobStatus.mockResolvedValue({
        id: 'job-123',
        user_id: 'other-user',
        status: 'completed',
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user&jobId=job-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should get job history for user', async () => {
      mockScheduler.getJobHistory.mockResolvedValue([
        {
          id: 'job-1',
          user_id: 'test-user',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'job-2',
          user_id: 'test-user',
          status: 'failed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user&limit=10');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobs).toHaveLength(2);
      expect(mockScheduler.getJobHistory).toHaveBeenCalledWith('test-user', 10);
    });

    it('should return job history with default limit', async () => {
      mockScheduler.getJobHistory.mockResolvedValue([
        {
          id: 'job-1',
          user_id: 'test-user',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'job-2',
          user_id: 'test-user',
          status: 'failed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobs).toHaveLength(2);
      expect(mockScheduler.getJobHistory).toHaveBeenCalledWith('test-user', 10);
    });

    it('should filter job history by status', async () => {
      mockScheduler.getJobHistory.mockResolvedValue([
        {
          id: 'job-1',
          user_id: 'test-user',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: 'job-2',
          user_id: 'test-user',
          status: 'failed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user&status=completed');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].status).toBe('completed');
      expect(mockScheduler.getJobHistory).toHaveBeenCalledWith('test-user', 10);
    });

    it('should return 400 when userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/sync');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('userId is required');
    });

    it('should handle exceptions', async () => {
      mockScheduler.getJobHistory.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/analytics/sync?userId=test-user');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Database error');
    });
  });
});
