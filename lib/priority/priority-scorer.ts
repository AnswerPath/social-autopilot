export interface PriorityScoreConfig {
  sentimentWeights: {
    positive: number;
    neutral: number;
    negative: number;
  };
  keywordWeights: {
    urgent: number;
    important: number;
  };
  influenceWeight: number;
  baseScore: number;
}

export interface MentionContext {
  text: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_confidence?: number;
  author_followers?: number;
  keywords?: string[];
}

export interface PriorityScore {
  score: number; // 0-100
  breakdown: {
    sentiment: number;
    keywords: number;
    influence: number;
    base: number;
  };
  reasons: string[];
}

/**
 * Service for calculating priority scores for mentions
 */
export class PriorityScorer {
  private config: PriorityScoreConfig;
  private urgentKeywords: string[] = [
    'urgent', 'emergency', 'help', 'issue', 'problem', 'broken', 'error',
    'critical', 'asap', 'immediately', 'complaint', 'refund', 'cancel',
    'hate', 'terrible', 'awful', 'worst', 'horrible', 'disappointed'
  ];
  private importantKeywords: string[] = [
    'question', 'inquiry', 'interested', 'purchase', 'buy', 'order',
    'partnership', 'collaboration', 'opportunity', 'feature request'
  ];

  constructor(config?: Partial<PriorityScoreConfig>) {
    this.config = {
      sentimentWeights: {
        positive: 10,
        neutral: 30,
        negative: 60,
      },
      keywordWeights: {
        urgent: 40,
        important: 20,
      },
      influenceWeight: 0.1, // 0.1 points per 1000 followers
      baseScore: 20,
      ...config,
    };
  }

  /**
   * Calculate priority score for a mention
   */
  calculateScore(context: MentionContext): PriorityScore {
    const breakdown = {
      sentiment: 0,
      keywords: 0,
      influence: 0,
      base: this.config.baseScore,
    };
    const reasons: string[] = [];

    // Sentiment scoring
    if (context.sentiment) {
      const sentimentWeight = this.config.sentimentWeights[context.sentiment];
      const confidence = context.sentiment_confidence || 0.5;
      breakdown.sentiment = sentimentWeight * confidence;
      reasons.push(`${context.sentiment} sentiment (${Math.round(confidence * 100)}% confidence)`);
    } else {
      breakdown.sentiment = this.config.sentimentWeights.neutral * 0.5;
    }

    // Keyword scoring
    const lowerText = context.text.toLowerCase();
    let urgentMatches = 0;
    let importantMatches = 0;

    for (const keyword of this.urgentKeywords) {
      if (lowerText.includes(keyword)) {
        urgentMatches++;
      }
    }

    for (const keyword of this.importantKeywords) {
      if (lowerText.includes(keyword)) {
        importantMatches++;
      }
    }

    if (urgentMatches > 0) {
      breakdown.keywords = this.config.keywordWeights.urgent * Math.min(urgentMatches, 3);
      reasons.push(`${urgentMatches} urgent keyword(s) found`);
    } else if (importantMatches > 0) {
      breakdown.keywords = this.config.keywordWeights.important * Math.min(importantMatches, 2);
      reasons.push(`${importantMatches} important keyword(s) found`);
    }

    // Influence scoring (based on follower count)
    if (context.author_followers) {
      const influencePoints = (context.author_followers / 1000) * this.config.influenceWeight;
      breakdown.influence = Math.min(influencePoints, 10); // Cap at 10 points
      if (context.author_followers > 10000) {
        reasons.push(`high influence user (${context.author_followers.toLocaleString()} followers)`);
      }
    }

    // Calculate total score (0-100)
    const totalScore = Math.min(
      breakdown.sentiment + breakdown.keywords + breakdown.influence + breakdown.base,
      100
    );

    return {
      score: Math.round(totalScore),
      breakdown,
      reasons,
    };
  }

  /**
   * Determine if a mention should be flagged based on score threshold
   */
  shouldFlag(score: number, threshold: number = 50): boolean {
    return score >= threshold;
  }

  /**
   * Get priority level from score
   */
  getPriorityLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }
}

/**
 * Factory function to create a priority scorer
 */
export function createPriorityScorer(config?: Partial<PriorityScoreConfig>): PriorityScorer {
  return new PriorityScorer(config);
}

