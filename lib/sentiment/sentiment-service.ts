import Sentiment from 'sentiment';

export type SentimentResult = 'positive' | 'neutral' | 'negative';

export interface SentimentAnalysis {
  sentiment: SentimentResult;
  confidence: number;
  score: number;
  comparative: number;
}

/**
 * Service for analyzing sentiment of text
 */
export class SentimentService {
  private analyzer: Sentiment;

  constructor() {
    this.analyzer = new Sentiment();
  }

  /**
   * Analyze sentiment of text
   */
  analyze(text: string): SentimentAnalysis {
    if (!text || text.trim().length === 0) {
      return {
        sentiment: 'neutral',
        confidence: 0,
        score: 0,
        comparative: 0,
      };
    }

    const result = this.analyzer.analyze(text);
    
    // Determine sentiment category
    let sentiment: SentimentResult = 'neutral';
    if (result.comparative > 0.1) {
      sentiment = 'positive';
    } else if (result.comparative < -0.1) {
      sentiment = 'negative';
    }

    // Calculate confidence (0-1) based on comparative score
    // Map comparative range (-5 to 5) to confidence (0 to 1)
    const normalizedScore = Math.abs(result.comparative);
    const confidence = Math.min(normalizedScore / 5, 1);

    return {
      sentiment,
      confidence,
      score: result.score,
      comparative: result.comparative,
    };
  }

  /**
   * Analyze sentiment for multiple texts
   */
  analyzeBatch(texts: string[]): SentimentAnalysis[] {
    return texts.map(text => this.analyze(text));
  }

  /**
   * Get sentiment distribution from batch analysis
   */
  getDistribution(analyses: SentimentAnalysis[]): {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  } {
    const distribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
      total: analyses.length,
    };

    for (const analysis of analyses) {
      distribution[analysis.sentiment]++;
    }

    return distribution;
  }
}

/**
 * Factory function to create a sentiment service
 */
export function createSentimentService(): SentimentService {
  return new SentimentService();
}

