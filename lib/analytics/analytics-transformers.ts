/**
 * Data transformation utilities for X API analytics
 * Normalizes X API responses to our database schema
 */

export interface PostAnalytics {
  tweetId: string;
  tweetText?: string;
  tweetCreatedAt?: Date;
  impressions?: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  clicks?: number;
  engagementRate?: number;
}

export interface FollowerAnalytics {
  followerCount: number;
  followingCount: number;
  tweetCount: number;
}

/**
 * Transform X API tweet analytics response to our PostAnalytics schema
 */
export function transformTweetAnalytics(raw: any): PostAnalytics {
  const metrics = raw.public_metrics || {};
  const totalEngagements = (metrics.like_count || 0) + 
                          (metrics.retweet_count || 0) + 
                          (metrics.reply_count || 0) + 
                          (metrics.quote_count || 0);

  // Calculate engagement rate if impressions are available
  const impressions = metrics.impression_count;
  const engagementRate = impressions && impressions > 0
    ? (totalEngagements / impressions) * 100
    : undefined;

  return {
    tweetId: raw.id || '',
    tweetText: raw.text || undefined,
    tweetCreatedAt: raw.created_at ? new Date(raw.created_at) : undefined,
    impressions: impressions,
    likes: metrics.like_count || 0,
    retweets: metrics.retweet_count || 0,
    replies: metrics.reply_count || 0,
    quotes: metrics.quote_count || 0,
    clicks: undefined, // Not available in public_metrics
    engagementRate: engagementRate,
  };
}

/**
 * Transform X API user metrics to our FollowerAnalytics schema
 */
export function transformUserMetrics(raw: any): FollowerAnalytics {
  const metrics = raw.public_metrics || {};

  return {
    followerCount: metrics.followers_count || 0,
    followingCount: metrics.following_count || 0,
    tweetCount: metrics.tweet_count || 0,
  };
}

/**
 * Calculate engagement rate from metrics
 * Formula: (likes + retweets + replies + quotes) / impressions * 100
 */
export function calculateEngagementRate(metrics: {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions?: number;
}): number | undefined {
  if (!metrics.impressions || metrics.impressions === 0) {
    return undefined;
  }

  const totalEngagements = metrics.likes + metrics.retweets + metrics.replies + metrics.quotes;
  return (totalEngagements / metrics.impressions) * 100;
}

/**
 * Calculate reach estimate
 * Note: True reach requires Analytics API access, this is an estimate
 */
export function calculateReach(impressions: number | undefined, followers: number): number | undefined {
  if (!impressions) {
    return undefined;
  }
  // Reach is typically less than or equal to impressions
  // This is a simplified estimate
  return Math.min(impressions, followers * 2); // Rough estimate
}

/**
 * Transform analytics result from getTweetAnalytics to PostAnalytics
 */
export function transformAnalyticsResult(analytics: {
  tweetId: string;
  impressions?: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  engagementRate?: number;
}, tweetText?: string, tweetCreatedAt?: string): PostAnalytics {
  return {
    tweetId: analytics.tweetId,
    tweetText: tweetText,
    tweetCreatedAt: tweetCreatedAt ? new Date(tweetCreatedAt) : undefined,
    impressions: analytics.impressions,
    likes: analytics.likes,
    retweets: analytics.retweets,
    replies: analytics.replies,
    quotes: analytics.quotes,
    engagementRate: analytics.engagementRate,
  };
}
