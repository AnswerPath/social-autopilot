import { supabaseAdmin } from '../supabase';

export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface EngagementMetrics {
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  autoRepliesSent: number;
  flaggedCount: number;
  responseRate: number; // Percentage of mentions that received auto-replies
  avgPriorityScore: number;
}

export interface RulePerformance {
  ruleId: string;
  ruleName: string;
  matches: number;
  repliesSent: number;
  successRate: number;
  avgSentiment: 'positive' | 'neutral' | 'negative';
}

export interface TimeSeriesData {
  date: string;
  mentions: number;
  replies: number;
  flagged: number;
  positive: number;
  negative: number;
  neutral: number;
}

/**
 * Service for generating engagement analytics
 */
export class EngagementAnalyticsService {
  /**
   * Get overall engagement metrics for a time range
   */
  async getMetrics(userId: string, timeRange?: AnalyticsTimeRange): Promise<EngagementMetrics> {
    try {
      let query = supabaseAdmin
        .from('mentions')
        .select('sentiment, is_replied, is_flagged, priority_score')
        .eq('user_id', userId);

      if (timeRange) {
        query = query
          .gte('created_at', timeRange.startDate.toISOString())
          .lte('created_at', timeRange.endDate.toISOString());
      }

      const { data: mentions, error } = await query;

      if (error) {
        throw error;
      }

      const totalMentions = mentions?.length || 0;
      const positiveCount = mentions?.filter(m => m.sentiment === 'positive').length || 0;
      const negativeCount = mentions?.filter(m => m.sentiment === 'negative').length || 0;
      const neutralCount = mentions?.filter(m => m.sentiment === 'neutral' || !m.sentiment).length || 0;
      const autoRepliesSent = mentions?.filter(m => m.is_replied).length || 0;
      const flaggedCount = mentions?.filter(m => m.is_flagged).length || 0;
      const responseRate = totalMentions > 0 ? (autoRepliesSent / totalMentions) * 100 : 0;
      
      const priorityScores = mentions?.map(m => m.priority_score || 0).filter(s => s > 0) || [];
      const avgPriorityScore = priorityScores.length > 0
        ? priorityScores.reduce((a, b) => a + b, 0) / priorityScores.length
        : 0;

      return {
        totalMentions,
        positiveCount,
        negativeCount,
        neutralCount,
        autoRepliesSent,
        flaggedCount,
        responseRate: Math.round(responseRate * 100) / 100,
        avgPriorityScore: Math.round(avgPriorityScore * 100) / 100,
      };
    } catch (error) {
      console.error('Error getting engagement metrics:', error);
      throw error;
    }
  }

  /**
   * Get rule performance metrics
   */
  async getRulePerformance(userId: string, timeRange?: AnalyticsTimeRange): Promise<RulePerformance[]> {
    try {
      // Get all rules
      const { data: rules, error: rulesError } = await supabaseAdmin
        .from('auto_reply_rules')
        .select('id, rule_name')
        .eq('user_id', userId);

      if (rulesError) {
        throw rulesError;
      }

      // Get auto-reply logs
      let logsQuery = supabaseAdmin
        .from('auto_reply_logs')
        .select('rule_id, success, mention_id')
        .eq('user_id', userId);

      if (timeRange) {
        logsQuery = logsQuery
          .gte('sent_at', timeRange.startDate.toISOString())
          .lte('sent_at', timeRange.endDate.toISOString());
      }

      const { data: logs, error: logsError } = await logsQuery;

      if (logsError) {
        throw logsError;
      }

      // Get mentions for sentiment analysis
      const mentionIds = logs?.map(l => l.mention_id).filter(Boolean) || [];
      const { data: mentions } = await supabaseAdmin
        .from('mentions')
        .select('id, sentiment')
        .in('id', mentionIds);

      // Calculate performance per rule
      const performance: RulePerformance[] = (rules || []).map(rule => {
        const ruleLogs = logs?.filter(l => l.rule_id === rule.id) || [];
        const matches = ruleLogs.length;
        const repliesSent = ruleLogs.filter(l => l.success).length;
        const successRate = matches > 0 ? (repliesSent / matches) * 100 : 0;

        // Calculate average sentiment
        const ruleMentionIds = ruleLogs.map(l => l.mention_id).filter(Boolean);
        const ruleMentions = mentions?.filter(m => ruleMentionIds.includes(m.id)) || [];
        const sentiments = ruleMentions.map(m => m.sentiment).filter(Boolean);
        const positiveCount = sentiments.filter(s => s === 'positive').length;
        const negativeCount = sentiments.filter(s => s === 'negative').length;
        
        let avgSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        if (positiveCount > negativeCount) {
          avgSentiment = 'positive';
        } else if (negativeCount > positiveCount) {
          avgSentiment = 'negative';
        }

        return {
          ruleId: rule.id,
          ruleName: rule.rule_name,
          matches,
          repliesSent,
          successRate: Math.round(successRate * 100) / 100,
          avgSentiment,
        };
      });

      return performance.sort((a, b) => b.matches - a.matches);
    } catch (error) {
      console.error('Error getting rule performance:', error);
      throw error;
    }
  }

  /**
   * Get time series data for charts
   */
  async getTimeSeriesData(userId: string, days: number = 30): Promise<TimeSeriesData[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: mentions, error } = await supabaseAdmin
        .from('mentions')
        .select('created_at, sentiment, is_replied, is_flagged')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Group by date
      const dateMap = new Map<string, TimeSeriesData>();

      mentions?.forEach(mention => {
        const date = new Date(mention.created_at).toISOString().split('T')[0];
        
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            mentions: 0,
            replies: 0,
            flagged: 0,
            positive: 0,
            negative: 0,
            neutral: 0,
          });
        }

        const data = dateMap.get(date)!;
        data.mentions++;
        if (mention.is_replied) data.replies++;
        if (mention.is_flagged) data.flagged++;
        if (mention.sentiment === 'positive') data.positive++;
        else if (mention.sentiment === 'negative') data.negative++;
        else data.neutral++;
      });

      // Convert to array and fill missing dates
      const result: TimeSeriesData[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        result.push(dateMap.get(dateStr) || {
          date: dateStr,
          mentions: 0,
          replies: 0,
          flagged: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
        });
      }

      return result;
    } catch (error) {
      console.error('Error getting time series data:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create an analytics service
 */
export function createEngagementAnalyticsService(): EngagementAnalyticsService {
  return new EngagementAnalyticsService();
}

