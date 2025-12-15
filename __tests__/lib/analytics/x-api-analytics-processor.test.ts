/**
 * Unit tests for X API Analytics Processor
 */

import { XApiAnalyticsProcessor } from '@/lib/analytics/x-api-analytics-processor';
import { XApiService } from '@/lib/x-api-service';
import { getUnifiedCredentials } from '@/lib/unified-credentials';
import { supabaseAdmin } from '@/lib/supabase';

// Mock dependencies
jest.mock('@/lib/unified-credentials');
jest.mock('@/lib/x-api-service');
jest.mock('@/lib/supabase');

const { createXApiService } = require('@/lib/x-api-service');

const mockGetUnifiedCredentials = getUnifiedCredentials as jest.MockedFunction<typeof getUnifiedCredentials>;
const mockSupabaseAdmin = supabaseAdmin as jest.Mocked<any>;

describe('XApiAnalyticsProcessor', () => {
  let processor: XApiAnalyticsProcessor;
  let mockXApiService: jest.Mocked<XApiService>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new XApiAnalyticsProcessor();

    // Mock X API Service
    mockXApiService = {
      testConnection: jest.fn(),
      getTweetAnalytics: jest.fn(),
      getUserAnalytics: jest.fn(),
      getTweetsWithAnalytics: jest.fn(),
      getUserTweets: jest.fn(),
    } as any;

    // Mock supabase
    mockSupabaseAdmin.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid credentials', async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-key',
          apiKeySecret: 'test-secret',
          accessToken: 'test-token',
          accessTokenSecret: 'test-token-secret',
          userId: 'test-user',
        },
      });

      const result = await processor.initialize('test-user');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail with demo credentials', async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'demo_key',
          apiKeySecret: 'demo_secret',
          accessToken: 'demo_token',
          accessTokenSecret: 'demo_token_secret',
          userId: 'test-user',
        },
      });

      const result = await processor.initialize('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Demo credentials');
    });

    it('should fail when credentials are not found', async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: false,
        error: 'No credentials found',
      });

      const result = await processor.initialize('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No X API credentials');
    });
  });

  describe('processPostAnalytics', () => {
    beforeEach(async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-key',
          apiKeySecret: 'test-secret',
          accessToken: 'test-token',
          accessTokenSecret: 'test-token-secret',
          userId: 'test-user',
        },
      });

      // Mock createXApiService to return our mock
      createXApiService.mockReturnValue(mockXApiService);
      
      // Mock testConnection to return user ID
      mockXApiService.testConnection.mockResolvedValue({
        success: true,
        user: { id: 'x-user-123' },
      });

      // Initialize processor
      await processor.initialize('test-user');
    });

    it('should process specific post IDs', async () => {
      mockXApiService.getTweetAnalytics.mockResolvedValue({
        success: true,
        analytics: {
          tweetId: 'tweet-123',
          likes: 100,
          retweets: 50,
          replies: 25,
          quotes: 10,
        },
      });

      mockXApiService.getUserTweets.mockResolvedValue({
        success: true,
        tweets: [
          {
            id: 'tweet-123',
            text: 'Test tweet',
            created_at: '2025-01-15T10:30:00Z',
          },
        ],
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await processor.processPostAnalytics('test-user', ['tweet-123']);

      expect(result.success).toBe(true);
      expect(result.postsProcessed).toBe(1);
      expect(mockXApiService.getTweetAnalytics).toHaveBeenCalledWith('tweet-123');
    });

    it('should fetch all user tweets when no postIds provided', async () => {
      mockXApiService.getTweetsWithAnalytics.mockResolvedValue({
        success: true,
        tweets: [
          {
            id: 'tweet-1',
            text: 'Tweet 1',
            created_at: '2025-01-15T10:30:00Z',
            analytics: {
              likes: 100,
              retweets: 50,
              replies: 25,
              quotes: 10,
            },
          },
          {
            id: 'tweet-2',
            text: 'Tweet 2',
            created_at: '2025-01-14T10:30:00Z',
            analytics: {
              likes: 200,
              retweets: 100,
              replies: 50,
              quotes: 20,
            },
          },
        ],
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(true);
      expect(result.postsProcessed).toBe(2);
      expect(mockXApiService.getTweetsWithAnalytics).toHaveBeenCalled();
    });

    it('should link to scheduled_posts when tweet ID matches', async () => {
      mockXApiService.getTweetsWithAnalytics.mockResolvedValue({
        success: true,
        tweets: [
          {
            id: 'tweet-123',
            text: 'Test tweet',
            created_at: '2025-01-15T10:30:00Z',
            analytics: {
              likes: 100,
              retweets: 50,
              replies: 25,
              quotes: 10,
            },
          },
        ],
      });

      // Mock finding scheduled post
      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'scheduled-post-123' },
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(true);
      expect(result.postsProcessed).toBe(1);
      
      // Verify upsert was called with scheduled_post_id
      const upsertCall = mockSupabaseAdmin.from().upsert.mock.calls[0];
      expect(upsertCall[0].scheduled_post_id).toBe('scheduled-post-123');
    });

    it('should handle rate limit errors gracefully', async () => {
      mockXApiService.getTweetsWithAnalytics.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should handle database errors', async () => {
      mockXApiService.getTweetsWithAnalytics.mockResolvedValue({
        success: true,
        tweets: [
          {
            id: 'tweet-123',
            text: 'Test tweet',
            analytics: {
              likes: 100,
              retweets: 50,
              replies: 25,
              quotes: 10,
            },
          },
        ],
      });

      mockSupabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(true);
      expect(result.postsFailed).toBe(1);
    });
  });

  describe('processFollowerAnalytics', () => {
    beforeEach(async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-key',
          apiKeySecret: 'test-secret',
          accessToken: 'test-token',
          accessTokenSecret: 'test-token-secret',
          userId: 'test-user',
        },
      });

      // Mock createXApiService to return our mock
      createXApiService.mockReturnValue(mockXApiService);
      
      // Initialize processor - it will use the mocked service
      await processor.initialize('test-user');
    });

    it('should process and store follower analytics', async () => {
      mockXApiService.getUserAnalytics.mockResolvedValue({
        success: true,
        analytics: {
          followerCount: 1000,
          followingCount: 500,
          tweetCount: 2500,
        },
      });

      mockSupabaseAdmin.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await processor.processFollowerAnalytics('test-user');

      expect(result.success).toBe(true);
      expect(result.followerCount).toBe(1000);
      expect(result.followingCount).toBe(500);
      expect(result.tweetCount).toBe(2500);
    });

    it('should handle API errors', async () => {
      mockXApiService.getUserAnalytics.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const result = await processor.processFollowerAnalytics('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
    });

    it('should handle database errors', async () => {
      mockXApiService.getUserAnalytics.mockResolvedValue({
        success: true,
        analytics: {
          followerCount: 1000,
          followingCount: 500,
          tweetCount: 2500,
        },
      });

      mockSupabaseAdmin.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const result = await processor.processFollowerAnalytics('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('Error handling', () => {
    it('should handle initialization failure in processPostAnalytics', async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: false,
        error: 'No credentials',
      });

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No X API credentials');
    });

    it('should handle missing user ID from testConnection', async () => {
      mockGetUnifiedCredentials.mockResolvedValue({
        success: true,
        credentials: {
          apiKey: 'test-key',
          apiKeySecret: 'test-secret',
          accessToken: 'test-token',
          accessTokenSecret: 'test-token-secret',
          userId: 'test-user',
        },
      });

      (processor as any).xApiService = mockXApiService;
      mockXApiService.testConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed',
      });

      const result = await processor.processPostAnalytics('test-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('authenticated user ID');
    });
  });
});
