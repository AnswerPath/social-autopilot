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
    // Using slightly more lenient thresholds to reduce neutral classifications
    // Original: 0.1/-0.1, New: 0.05/-0.05
    let sentiment: SentimentResult = 'neutral';
    if (result.comparative > 0.05) {
      sentiment = 'positive';
    } else if (result.comparative < -0.05) {
      sentiment = 'negative';
    }

    // Calculate confidence (0-1) based on comparative score
    // Map comparative range (-5 to 5) to confidence (0 to 1)
    // Use a more nuanced mapping that gives higher confidence for stronger signals
    const normalizedScore = Math.abs(result.comparative);
    // Scale: 0.05 -> ~0.1 confidence, 0.5 -> ~0.5 confidence, 2.0 -> 1.0 confidence
    const confidence = Math.min(Math.max(normalizedScore * 0.5, 0.1), 1);

    // Log analysis for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SentimentService] Analyzed: "${text.substring(0, 50)}..."`, {
        sentiment,
        confidence: confidence.toFixed(2),
        comparative: result.comparative.toFixed(3),
        score: result.score,
      });
    }

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

