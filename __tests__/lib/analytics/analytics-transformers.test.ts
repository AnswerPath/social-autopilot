/**
 * Unit tests for analytics transformers
 */

import {
  transformTweetAnalytics,
  transformUserMetrics,
  transformAnalyticsResult,
  calculateEngagementRate,
  calculateReach,
  PostAnalytics,
} from '@/lib/analytics/analytics-transformers';

describe('Analytics Transformers', () => {
  describe('transformTweetAnalytics', () => {
    it('should transform X API tweet response with all metrics', () => {
      const rawTweet = {
        id: '1234567890',
        text: 'Test tweet content',
        created_at: '2025-01-15T10:30:00Z',
        public_metrics: {
          like_count: 100,
          retweet_count: 50,
          reply_count: 25,
          quote_count: 10,
          impression_count: 5000,
        },
      };

      const result = transformTweetAnalytics(rawTweet);

      expect(result.tweetId).toBe('1234567890');
      expect(result.tweetText).toBe('Test tweet content');
      expect(result.tweetCreatedAt).toEqual(new Date('2025-01-15T10:30:00Z'));
      expect(result.impressions).toBe(5000);
      expect(result.likes).toBe(100);
      expect(result.retweets).toBe(50);
      expect(result.replies).toBe(25);
      expect(result.quotes).toBe(10);
      expect(result.engagementRate).toBeCloseTo(3.7, 1); // (185/5000)*100
    });

    it('should handle missing metrics gracefully', () => {
      const rawTweet = {
        id: '1234567890',
        text: 'Test tweet',
        public_metrics: {},
      };

      const result = transformTweetAnalytics(rawTweet);

      expect(result.tweetId).toBe('1234567890');
      expect(result.likes).toBe(0);
      expect(result.retweets).toBe(0);
      expect(result.replies).toBe(0);
      expect(result.quotes).toBe(0);
      expect(result.impressions).toBeUndefined();
      expect(result.engagementRate).toBeUndefined();
    });

    it('should handle missing public_metrics', () => {
      const rawTweet = {
        id: '1234567890',
        text: 'Test tweet',
      };

      const result = transformTweetAnalytics(rawTweet);

      expect(result.tweetId).toBe('1234567890');
      expect(result.likes).toBe(0);
      expect(result.retweets).toBe(0);
      expect(result.replies).toBe(0);
      expect(result.quotes).toBe(0);
    });

    it('should calculate engagement rate when impressions are available', () => {
      const rawTweet = {
        id: '1234567890',
        public_metrics: {
          like_count: 200,
          retweet_count: 100,
          reply_count: 50,
          quote_count: 25,
          impression_count: 10000,
        },
      };

      const result = transformTweetAnalytics(rawTweet);

      // (200 + 100 + 50 + 25) / 10000 * 100 = 3.75%
      expect(result.engagementRate).toBeCloseTo(3.75, 2);
    });

    it('should not calculate engagement rate when impressions are missing', () => {
      const rawTweet = {
        id: '1234567890',
        public_metrics: {
          like_count: 100,
          retweet_count: 50,
        },
      };

      const result = transformTweetAnalytics(rawTweet);

      expect(result.engagementRate).toBeUndefined();
    });
  });

  describe('transformUserMetrics', () => {
    it('should transform user metrics correctly', () => {
      const rawUser = {
        public_metrics: {
          followers_count: 1000,
          following_count: 500,
          tweet_count: 2500,
        },
      };

      const result = transformUserMetrics(rawUser);

      expect(result.followerCount).toBe(1000);
      expect(result.followingCount).toBe(500);
      expect(result.tweetCount).toBe(2500);
    });

    it('should handle missing metrics', () => {
      const rawUser = {
        public_metrics: {},
      };

      const result = transformUserMetrics(rawUser);

      expect(result.followerCount).toBe(0);
      expect(result.followingCount).toBe(0);
      expect(result.tweetCount).toBe(0);
    });

    it('should handle missing public_metrics', () => {
      const rawUser = {};

      const result = transformUserMetrics(rawUser);

      expect(result.followerCount).toBe(0);
      expect(result.followingCount).toBe(0);
      expect(result.tweetCount).toBe(0);
    });
  });

  describe('calculateEngagementRate', () => {
    it('should calculate engagement rate correctly', () => {
      const metrics = {
        likes: 100,
        retweets: 50,
        replies: 25,
        quotes: 10,
        impressions: 5000,
      };

      const rate = calculateEngagementRate(metrics);

      // (100 + 50 + 25 + 10) / 5000 * 100 = 3.7%
      expect(rate).toBeCloseTo(3.7, 1);
    });

    it('should return undefined when impressions are missing', () => {
      const metrics = {
        likes: 100,
        retweets: 50,
        replies: 25,
        quotes: 10,
      };

      const rate = calculateEngagementRate(metrics);

      expect(rate).toBeUndefined();
    });

    it('should return undefined when impressions are zero', () => {
      const metrics = {
        likes: 100,
        retweets: 50,
        replies: 25,
        quotes: 10,
        impressions: 0,
      };

      const rate = calculateEngagementRate(metrics);

      expect(rate).toBeUndefined();
    });

    it('should handle zero engagements', () => {
      const metrics = {
        likes: 0,
        retweets: 0,
        replies: 0,
        quotes: 0,
        impressions: 1000,
      };

      const rate = calculateEngagementRate(metrics);

      expect(rate).toBe(0);
    });
  });

  describe('calculateReach', () => {
    it('should calculate reach estimate', () => {
      const reach = calculateReach(5000, 1000);

      // Reach should be min(5000, 1000 * 2) = 2000
      expect(reach).toBe(2000);
    });

    it('should return impressions when less than follower estimate', () => {
      const reach = calculateReach(500, 1000);

      // Reach should be min(500, 2000) = 500
      expect(reach).toBe(500);
    });

    it('should return undefined when impressions are missing', () => {
      const reach = calculateReach(undefined, 1000);

      expect(reach).toBeUndefined();
    });
  });

  describe('transformAnalyticsResult', () => {
    it('should transform analytics result with tweet details', () => {
      const analytics = {
        tweetId: '1234567890',
        impressions: 5000,
        likes: 100,
        retweets: 50,
        replies: 25,
        quotes: 10,
        engagementRate: 3.7,
      };

      const result = transformAnalyticsResult(
        analytics,
        'Test tweet text',
        '2025-01-15T10:30:00Z'
      );

      expect(result.tweetId).toBe('1234567890');
      expect(result.tweetText).toBe('Test tweet text');
      expect(result.tweetCreatedAt).toEqual(new Date('2025-01-15T10:30:00Z'));
      expect(result.impressions).toBe(5000);
      expect(result.likes).toBe(100);
      expect(result.retweets).toBe(50);
      expect(result.replies).toBe(25);
      expect(result.quotes).toBe(10);
      expect(result.engagementRate).toBe(3.7);
    });

    it('should handle missing optional fields', () => {
      const analytics = {
        tweetId: '1234567890',
        likes: 100,
        retweets: 50,
        replies: 25,
        quotes: 10,
      };

      const result = transformAnalyticsResult(analytics);

      expect(result.tweetId).toBe('1234567890');
      expect(result.tweetText).toBeUndefined();
      expect(result.tweetCreatedAt).toBeUndefined();
      expect(result.impressions).toBeUndefined();
      expect(result.engagementRate).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle null values gracefully', () => {
      const rawTweet = {
        id: '1234567890',
        public_metrics: {
          like_count: null,
          retweet_count: undefined,
        },
      };

      const result = transformTweetAnalytics(rawTweet as any);

      expect(result.likes).toBe(0);
      expect(result.retweets).toBe(0);
    });

    it('should handle very large numbers', () => {
      const rawTweet = {
        id: '1234567890',
        public_metrics: {
          like_count: 1000000,
          retweet_count: 500000,
          impression_count: 10000000,
        },
      };

      const result = transformTweetAnalytics(rawTweet);

      expect(result.likes).toBe(1000000);
      expect(result.retweets).toBe(500000);
      expect(result.impressions).toBe(10000000);
      expect(result.engagementRate).toBeCloseTo(15.0, 1); // (1500000/10000000)*100
    });
  });
});
