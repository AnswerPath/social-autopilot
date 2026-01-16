import { createPostAnalyticsService } from './post-analytics-service';
import { HistoricalAnalytics } from './post-analytics-service';

export interface PostingTimeRecommendation {
  hour: number; // 0-23
  dayOfWeek: number; // 0-6 (Sunday = 0)
  confidence: number; // 0-1
  reasoning: string;
  averageEngagementRate: number;
  postCount: number; // Number of posts in this time slot
  totalEngagement: number;
  totalImpressions: number;
}

export interface TimeSlotAnalytics {
  hour: number;
  dayOfWeek: number;
  posts: Array<{
    engagementRate: number;
    totalEngagement: number;
    impressions: number;
    postedAt: Date;
  }>;
  averageEngagementRate: number;
  weightedEngagementRate: number; // Weighted by impressions
  postCount: number;
  totalEngagement: number;
  totalImpressions: number;
}

/**
 * Service for generating AI-driven posting time recommendations
 * based on historical engagement patterns
 */
export class RecommendationService {
  private analyticsService = createPostAnalyticsService();

  /**
   * Generate recommendations for optimal posting times
   */
  async generateRecommendations(
    userId: string,
    limit: number = 5
  ): Promise<{ success: boolean; recommendations?: PostingTimeRecommendation[]; error?: string }> {
    try {
      // Fetch historical analytics (last 90 days for better sample size)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 90);

      const historicalResult = await this.analyticsService.getHistoricalAnalytics(userId, {
        startDate,
        endDate,
      });

      if (!historicalResult.success || !historicalResult.data) {
        return {
          success: false,
          error: historicalResult.error || 'Failed to fetch historical analytics',
        };
      }

      const historicalData = historicalResult.data;

      // Filter out posts without analytics
      const postsWithAnalytics = historicalData.filter(
        (post) => post.latest && post.latest.impressions && post.latest.impressions > 0
      );

      if (postsWithAnalytics.length < 5) {
        return {
          success: false,
          error: 'Insufficient data. Need at least 5 posts with analytics to generate recommendations.',
        };
      }

      // Analyze time slots
      const timeSlots = this.analyzeTimeSlots(postsWithAnalytics);

      // Generate recommendations
      const recommendations = this.generateRecommendationsFromSlots(timeSlots, limit);

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations',
      };
    }
  }

  /**
   * Get recommended times for a specific day of week
   */
  async getRecommendedTimesForDay(
    userId: string,
    dayOfWeek: number
  ): Promise<{ success: boolean; recommendations?: PostingTimeRecommendation[]; error?: string }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 90);

      const historicalResult = await this.analyticsService.getHistoricalAnalytics(userId, {
        startDate,
        endDate,
      });

      if (!historicalResult.success || !historicalResult.data) {
        return {
          success: false,
          error: historicalResult.error || 'Failed to fetch historical analytics',
        };
      }

      const historicalData = historicalResult.data;
      const postsWithAnalytics = historicalData.filter(
        (post) => post.latest && post.latest.impressions && post.latest.impressions > 0
      );

      if (postsWithAnalytics.length < 3) {
        return {
          success: false,
          error: 'Insufficient data for this day.',
        };
      }

      // Filter posts for the specific day
      const dayPosts = postsWithAnalytics.filter((post) => {
        const postDate = new Date(post.postedAt);
        return postDate.getDay() === dayOfWeek;
      });

      if (dayPosts.length < 2) {
        return {
          success: false,
          error: `Insufficient data for ${this.getDayName(dayOfWeek)}.`,
        };
      }

      // Analyze time slots for this day
      const timeSlots = this.analyzeTimeSlots(dayPosts);
      const daySlots = timeSlots.filter((slot) => slot.dayOfWeek === dayOfWeek);

      // Generate recommendations
      const recommendations = this.generateRecommendationsFromSlots(daySlots, 3);

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      console.error('Error getting recommendations for day:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recommendations',
      };
    }
  }

  /**
   * Analyze historical posts and group by time slots (hour + day of week)
   */
  private analyzeTimeSlots(historicalData: HistoricalAnalytics[]): TimeSlotAnalytics[] {
    const slotMap = new Map<string, TimeSlotAnalytics>();

    historicalData.forEach((post) => {
      if (!post.latest || !post.latest.impressions || post.latest.impressions === 0) {
        return;
      }

      const postedAt = new Date(post.postedAt);
      const hour = postedAt.getHours();
      const dayOfWeek = postedAt.getDay();

      const slotKey = `${dayOfWeek}-${hour}`;

      const totalEngagement =
        post.latest.likes + post.latest.retweets + post.latest.replies + post.latest.quotes;
      const engagementRate = post.latest.engagement_rate || 0;

      if (!slotMap.has(slotKey)) {
        slotMap.set(slotKey, {
          hour,
          dayOfWeek,
          posts: [],
          averageEngagementRate: 0,
          weightedEngagementRate: 0,
          postCount: 0,
          totalEngagement: 0,
          totalImpressions: 0,
        });
      }

      const slot = slotMap.get(slotKey)!;
      slot.posts.push({
        engagementRate,
        totalEngagement,
        impressions: post.latest.impressions,
        postedAt,
      });
      slot.postCount += 1;
      slot.totalEngagement += totalEngagement;
      slot.totalImpressions += post.latest.impressions || 0;
    });

    // Calculate averages and weighted rates
    const slots: TimeSlotAnalytics[] = [];
    slotMap.forEach((slot) => {
      // Simple average engagement rate
      slot.averageEngagementRate =
        slot.posts.reduce((sum, p) => sum + p.engagementRate, 0) / slot.postCount;

      // Since engagement rate is now based on likes only, use simple average
      // (weighted by impressions no longer makes sense)
      slot.weightedEngagementRate = slot.averageEngagementRate;

      slots.push(slot);
    });

    return slots;
  }

  /**
   * Generate recommendations from analyzed time slots
   */
  private generateRecommendationsFromSlots(
    timeSlots: TimeSlotAnalytics[],
    limit: number
  ): PostingTimeRecommendation[] {
    // Sort by weighted engagement rate (more reliable than simple average)
    // Also consider sample size for confidence
    const scoredSlots = timeSlots.map((slot) => {
      // Confidence score based on sample size (more posts = higher confidence)
      // Minimum 2 posts for any confidence, max confidence at 10+ posts
      const sampleSizeConfidence = Math.min(1, (slot.postCount - 1) / 9);

      // Engagement rate score (normalized to 0-1, assuming max 10% engagement rate)
      const engagementScore = Math.min(1, slot.weightedEngagementRate / 10);

      // Combined score (weighted: 60% engagement, 40% confidence)
      const combinedScore = engagementScore * 0.6 + sampleSizeConfidence * 0.4;

      return {
        slot,
        score: combinedScore,
        confidence: sampleSizeConfidence,
      };
    });

    // Sort by score (descending)
    scoredSlots.sort((a, b) => b.score - a.score);

    // Take top N and convert to recommendations
    return scoredSlots.slice(0, limit).map(({ slot, confidence }) => {
      const reasoning = this.generateReasoning(slot, confidence);
      return {
        hour: slot.hour,
        dayOfWeek: slot.dayOfWeek,
        confidence: Math.round(confidence * 100) / 100,
        reasoning,
        averageEngagementRate: slot.weightedEngagementRate,
        postCount: slot.postCount,
        totalEngagement: slot.totalEngagement,
        totalImpressions: slot.totalImpressions,
      };
    });
  }

  /**
   * Generate human-readable reasoning for a recommendation
   */
  private generateReasoning(slot: TimeSlotAnalytics, confidence: number): string {
    const dayName = this.getDayName(slot.dayOfWeek);
    const timeOfDay = this.getTimeOfDayLabel(slot.hour);
    const engagementRate = slot.weightedEngagementRate.toFixed(2);

    if (confidence >= 0.7) {
      return `Your posts on ${dayName} at ${timeOfDay} consistently perform well with an average engagement rate of ${engagementRate}% across ${slot.postCount} posts. This time slot shows strong audience activity.`;
    } else if (confidence >= 0.4) {
      return `Based on ${slot.postCount} posts, ${dayName} at ${timeOfDay} shows promising engagement (${engagementRate}%). More data would increase confidence in this recommendation.`;
    } else {
      return `Limited data (${slot.postCount} posts) suggests ${dayName} at ${timeOfDay} may be effective (${engagementRate}% engagement). Consider testing this time slot more frequently.`;
    }
  }

  /**
   * Get day name from day of week number
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  /**
   * Get time of day label
   */
  private getTimeOfDayLabel(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  /**
   * Get heatmap data for visualization
   * Returns engagement rates by hour (0-23) and day of week (0-6)
   */
  async getHeatmapData(
    userId: string
  ): Promise<{ success: boolean; data?: number[][]; error?: string }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 90);

      const historicalResult = await this.analyticsService.getHistoricalAnalytics(userId, {
        startDate,
        endDate,
      });

      if (!historicalResult.success || !historicalResult.data) {
        return {
          success: false,
          error: historicalResult.error || 'Failed to fetch historical analytics',
        };
      }

      const historicalData = historicalResult.data;
      const postsWithAnalytics = historicalData.filter(
        (post) => post.latest && post.latest.impressions && post.latest.impressions > 0
      );

      if (postsWithAnalytics.length < 5) {
        return {
          success: false,
          error: 'Insufficient data for heatmap',
        };
      }

      // Initialize 7x24 matrix (days x hours)
      const heatmapData: number[][] = Array(7)
        .fill(null)
        .map(() => Array(24).fill(0));

      const slotMap = new Map<string, { totalRate: number; count: number }>();

      // Group by day and hour
      postsWithAnalytics.forEach((post) => {
        const postedAt = new Date(post.postedAt);
        const hour = postedAt.getHours();
        const dayOfWeek = postedAt.getDay();

        const slotKey = `${dayOfWeek}-${hour}`;
        const engagementRate = post.latest!.engagement_rate || 0;

        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, { totalRate: 0, count: 0 });
        }

        const slot = slotMap.get(slotKey)!;
        slot.totalRate += engagementRate;
        slot.count += 1;
      });

      // Calculate averages and populate matrix
      slotMap.forEach((slot, key) => {
        const [dayStr, hourStr] = key.split('-');
        const day = parseInt(dayStr, 10);
        const hour = parseInt(hourStr, 10);
        const avgRate = slot.count > 0 ? slot.totalRate / slot.count : 0;
        heatmapData[day][hour] = avgRate;
      });

      return {
        success: true,
        data: heatmapData,
      };
    } catch (error) {
      console.error('Error getting heatmap data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate heatmap data',
      };
    }
  }
}

/**
 * Factory function to create a RecommendationService instance
 */
export function createRecommendationService(): RecommendationService {
  return new RecommendationService();
}
