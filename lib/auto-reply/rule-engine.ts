export interface AutoReplyRule {
  id: string;
  user_id: string;
  rule_name: string;
  keywords: string[];
  phrases: string[];
  response_template: string;
  is_active: boolean;
  priority: number;
  throttle_settings: {
    max_per_hour: number;
    max_per_day: number;
    cooldown_minutes: number;
  };
  match_type: 'any' | 'all';
  sentiment_filter: string[];
  created_at?: string;
  updated_at?: string;
}

export interface RuleMatchResult {
  matched: boolean;
  rule: AutoReplyRule | null;
  matchedKeywords: string[];
  matchedPhrases: string[];
  confidence: number;
}

export interface ThrottleStatus {
  canReply: boolean;
  reason?: string;
  nextAvailableAt?: Date;
}

/**
 * Rule engine for matching mentions against auto-reply rules
 */
export class RuleEngine {
  private rules: AutoReplyRule[] = [];
  // Sliding window: store array of reply timestamps for time-based throttling
  private throttleCache: Map<string, { replyTimes: Date[] }> = new Map();

  /**
   * Load rules into the engine
   */
  loadRules(rules: AutoReplyRule[]): void {
    // Filter to only active rules and sort by priority (higher priority first)
    this.rules = rules
      .filter(rule => rule.is_active)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match a mention against all rules and return the best match
   */
  matchMention(mentionText: string, sentiment?: string): RuleMatchResult {
    const lowerText = mentionText.toLowerCase();
    let bestMatch: RuleMatchResult | null = null;
    let bestScore = -1;

    for (const rule of this.rules) {
      const match = this.matchRule(rule, lowerText, sentiment);
      
      if (match.matched) {
        // Weighted score: confidence (0-1) + normalized priority (0-0.5)
        // Higher priority rules get more weight, but confidence still matters
        const maxPriority = Math.max(...this.rules.map(r => r.priority), 1);
        const score = match.confidence + (rule.priority / maxPriority) * 0.5;
        
        if (score > bestScore) {
          bestMatch = match;
          bestScore = score;
        }
      }
    }

    return bestMatch || {
      matched: false,
      rule: null,
      matchedKeywords: [],
      matchedPhrases: [],
      confidence: 0,
    };
  }

  /**
   * Test a single rule against mention text (public method for testing)
   */
  testRule(rule: AutoReplyRule, mentionText: string, sentiment?: string): RuleMatchResult {
    return this.matchRule(rule, mentionText.toLowerCase(), sentiment);
  }

  /**
   * Match a single rule against mention text
   */
  private matchRule(rule: AutoReplyRule, lowerText: string, sentiment?: string): RuleMatchResult {
    // Check sentiment filter if specified
    // Rules with sentiment_filter require a computed sentiment to match
    if (rule.sentiment_filter.length > 0) {
      if (!sentiment || !rule.sentiment_filter.includes(sentiment)) {
        return {
          matched: false,
          rule,
          matchedKeywords: [],
          matchedPhrases: [],
          confidence: 0,
        };
      }
    }

    const matchedKeywords: string[] = [];
    const matchedPhrases: string[] = [];

    // Check keywords
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }

    // Check phrases
    for (const phrase of rule.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        matchedPhrases.push(phrase);
      }
    }

    // Determine if rule matches based on match_type
    let matched = false;
    if (rule.match_type === 'any') {
      matched = matchedKeywords.length > 0 || matchedPhrases.length > 0;
    } else if (rule.match_type === 'all') {
      const totalMatches = matchedKeywords.length + matchedPhrases.length;
      const totalPatterns = rule.keywords.length + rule.phrases.length;
      matched = totalMatches === totalPatterns && totalPatterns > 0;
    }

    // Calculate confidence score (0-1)
    let confidence = 0;
    if (matched) {
      const totalPatterns = rule.keywords.length + rule.phrases.length;
      const totalMatches = matchedKeywords.length + matchedPhrases.length;
      confidence = totalPatterns > 0 ? totalMatches / totalPatterns : 0;
    }

    return {
      matched,
      rule,
      matchedKeywords,
      matchedPhrases,
      confidence,
    };
  }

  /**
   * Generate response text from template
   */
  generateResponse(rule: AutoReplyRule, mention: { text: string; author_username: string; author_name?: string }): string {
    let response = rule.response_template;

    // Replace variables in template
    response = response.replace(/\{\{author_username\}\}/g, mention.author_username);
    response = response.replace(/\{\{author_name\}\}/g, mention.author_name || mention.author_username);
    response = response.replace(/\{\{mention_text\}\}/g, mention.text.substring(0, 100)); // Limit to 100 chars

    return response;
  }

  /**
   * Check if a rule can reply based on throttle settings
   */
  checkThrottle(rule: AutoReplyRule, userId: string): ThrottleStatus {
    const cacheKey = `${rule.id}:${userId}`;
    const now = new Date();
    const cached = this.throttleCache.get(cacheKey);

    if (!cached) {
      // First reply, allow it (recordReply will initialize the cache)
      return { canReply: true };
    }

    // Remove replies older than 1 day to keep sliding window manageable
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    cached.replyTimes = cached.replyTimes.filter(t => t > oneDayAgo);

    // Get the most recent reply for cooldown check
    const lastReply = cached.replyTimes.length > 0 
      ? cached.replyTimes[cached.replyTimes.length - 1] 
      : null;

    if (!lastReply) {
      // No recent replies, allow it
      return { canReply: true };
    }

    const timeSinceLastReply = now.getTime() - lastReply.getTime();
    const cooldownMs = rule.throttle_settings.cooldown_minutes * 60 * 1000;

    // Check cooldown
    if (timeSinceLastReply < cooldownMs) {
      const nextAvailable = new Date(lastReply.getTime() + cooldownMs);
      return {
        canReply: false,
        reason: 'cooldown',
        nextAvailableAt: nextAvailable,
      };
    }

    // Check hourly limit (sliding window: replies within last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const repliesLastHour = cached.replyTimes.filter(t => t > oneHourAgo).length;
    if (repliesLastHour >= rule.throttle_settings.max_per_hour) {
      const oldestInWindow = cached.replyTimes.find(t => t > oneHourAgo);
      const nextAvailable = oldestInWindow 
        ? new Date(oldestInWindow.getTime() + 60 * 60 * 1000)
        : new Date(now.getTime() + 60 * 60 * 1000);
      return {
        canReply: false,
        reason: 'hourly_limit',
        nextAvailableAt: nextAvailable,
      };
    }

    // Check daily limit (total replies in last 24 hours)
    if (cached.replyTimes.length >= rule.throttle_settings.max_per_day) {
      const oldestReply = cached.replyTimes[0];
      const nextDay = new Date(oldestReply);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      return {
        canReply: false,
        reason: 'daily_limit',
        nextAvailableAt: nextDay,
      };
    }

    // All checks passed - can reply (recordReply will update the cache)
    return { canReply: true };
  }

  /**
   * Record a reply for throttle tracking
   */
  recordReply(rule: AutoReplyRule, userId: string): void {
    const cacheKey = `${rule.id}:${userId}`;
    const cached = this.throttleCache.get(cacheKey);
    const now = new Date();
    
    if (!cached) {
      this.throttleCache.set(cacheKey, { replyTimes: [now] });
    } else {
      // Add new reply timestamp and prune old entries (older than 1 day)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      cached.replyTimes = cached.replyTimes.filter(t => t > oneDayAgo);
      cached.replyTimes.push(now);
    }
  }

  /**
   * Clear throttle cache (useful for testing or reset)
   */
  clearThrottleCache(): void {
    this.throttleCache.clear();
  }
}

/**
 * Factory function to create a rule engine
 */
export function createRuleEngine(): RuleEngine {
  return new RuleEngine();
}

