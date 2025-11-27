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
  private throttleCache: Map<string, { count: number; lastReply: Date }> = new Map();

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

    for (const rule of this.rules) {
      const match = this.matchRule(rule, lowerText, sentiment);
      
      if (match.matched) {
        // If no best match yet, or this rule has higher priority/confidence
        if (!bestMatch || match.confidence > bestMatch.confidence || rule.priority > (bestMatch.rule?.priority || 0)) {
          bestMatch = match;
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
   * Match a single rule against mention text
   */
  private matchRule(rule: AutoReplyRule, lowerText: string, sentiment?: string): RuleMatchResult {
    // Check sentiment filter if specified
    if (rule.sentiment_filter.length > 0 && sentiment) {
      if (!rule.sentiment_filter.includes(sentiment)) {
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
      // First reply, allow it
      this.throttleCache.set(cacheKey, {
        count: 1,
        lastReply: now,
      });
      return { canReply: true };
    }

    const timeSinceLastReply = now.getTime() - cached.lastReply.getTime();
    const cooldownMs = rule.throttle_settings.cooldown_minutes * 60 * 1000;

    // Check cooldown
    if (timeSinceLastReply < cooldownMs) {
      const nextAvailable = new Date(cached.lastReply.getTime() + cooldownMs);
      return {
        canReply: false,
        reason: 'cooldown',
        nextAvailableAt: nextAvailable,
      };
    }

    // Check hourly limit
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (cached.lastReply > oneHourAgo && cached.count >= rule.throttle_settings.max_per_hour) {
      const nextAvailable = new Date(cached.lastReply.getTime() + 60 * 60 * 1000);
      return {
        canReply: false,
        reason: 'hourly_limit',
        nextAvailableAt: nextAvailable,
      };
    }

    // Check daily limit (simplified - would need more sophisticated tracking in production)
    if (cached.count >= rule.throttle_settings.max_per_day) {
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      return {
        canReply: false,
        reason: 'daily_limit',
        nextAvailableAt: nextDay,
      };
    }

    // Update cache
    this.throttleCache.set(cacheKey, {
      count: cached.count + 1,
      lastReply: now,
    });

    return { canReply: true };
  }

  /**
   * Record a reply for throttle tracking
   */
  recordReply(rule: AutoReplyRule, userId: string): void {
    const cacheKey = `${rule.id}:${userId}`;
    const cached = this.throttleCache.get(cacheKey);
    
    if (cached) {
      cached.count += 1;
      cached.lastReply = new Date();
    } else {
      this.throttleCache.set(cacheKey, {
        count: 1,
        lastReply: new Date(),
      });
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

