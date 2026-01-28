/**
 * Analytics-specific rate limiter for X API analytics endpoints
 * Handles rate limits separately from posting endpoints
 */

interface RateLimitState {
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  limit: number;
}

export class AnalyticsRateLimiter {
  private rateLimits: Map<string, RateLimitState> = new Map();
  private readonly defaultLimit = 300; // X API analytics endpoints typically allow 300 requests per 15 minutes
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes in milliseconds

  /**
   * Check if a request can be made
   */
  canMakeRequest(endpoint: string = 'default'): boolean {
    const state = this.rateLimits.get(endpoint);
    
    if (!state) {
      return true; // No limit tracked yet
    }

    // Check if window has reset
    const now = Date.now();
    if (now >= state.resetAt * 1000) {
      // Reset the limit
      this.rateLimits.delete(endpoint);
      return true;
    }

    return state.remaining > 0;
  }

  /**
   * Record a request and update rate limit state
   */
  recordRequest(endpoint: string = 'default', remaining?: number, resetAt?: number, limit?: number): void {
    const now = Date.now();
    
    if (remaining !== undefined && resetAt !== undefined && limit !== undefined) {
      // Update with actual values from API response
      this.rateLimits.set(endpoint, {
        remaining,
        resetAt,
        limit,
      });
    } else {
      // Use default tracking
      const state = this.rateLimits.get(endpoint);
      if (state && now < state.resetAt * 1000) {
        // Decrement remaining
        state.remaining = Math.max(0, state.remaining - 1);
      } else {
        // Create new state
        this.rateLimits.set(endpoint, {
          remaining: this.defaultLimit - 1,
          resetAt: Math.floor((now + this.windowMs) / 1000),
          limit: this.defaultLimit,
        });
      }
    }
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getTimeUntilReset(endpoint: string = 'default'): number {
    const state = this.rateLimits.get(endpoint);
    if (!state) {
      return 0;
    }

    const now = Date.now();
    const resetTime = state.resetAt * 1000;
    
    return Math.max(0, resetTime - now);
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(endpoint: string = 'default'): number {
    const state = this.rateLimits.get(endpoint);
    if (!state) {
      return this.defaultLimit;
    }

    const now = Date.now();
    if (now >= state.resetAt * 1000) {
      return this.defaultLimit; // Window has reset
    }

    return state.remaining;
  }

  /**
   * Wait until rate limit resets
   */
  async waitForReset(endpoint: string = 'default'): Promise<void> {
    const waitTime = this.getTimeUntilReset(endpoint);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Clear rate limit state (useful for testing or manual reset)
   */
  clear(endpoint?: string): void {
    if (endpoint) {
      this.rateLimits.delete(endpoint);
    } else {
      this.rateLimits.clear();
    }
  }
}

/**
 * Global rate limiter instance for analytics
 */
export const analyticsRateLimiter = new AnalyticsRateLimiter();
