jest.mock('@sentry/nextjs', () => ({
  withScope: (fn: (scope: { setTag: () => void; setContext: () => void; setUser: () => void }) => void) => {
    fn({
      setTag: jest.fn(),
      setContext: jest.fn(),
      setUser: jest.fn(),
    });
  },
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    fatal: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  ApiErrorHandler,
  CircuitBreaker,
  ErrorMonitor,
  ErrorType,
  type ApiError,
  type RetryConfig,
} from '@/lib/error-handling';

describe('ApiErrorHandler', () => {
  describe('calculateRetryDelay', () => {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [ErrorType.NETWORK_ERROR],
    };

    it('increases delay with exponential backoff', () => {
      expect(ApiErrorHandler.calculateRetryDelay(0, defaultConfig)).toBe(1000);
      expect(ApiErrorHandler.calculateRetryDelay(1, defaultConfig)).toBe(2000);
      expect(ApiErrorHandler.calculateRetryDelay(2, defaultConfig)).toBe(4000);
    });

    it('caps at maxDelay', () => {
      expect(ApiErrorHandler.calculateRetryDelay(10, defaultConfig)).toBe(30000);
    });
  });

  describe('normalizeError', () => {
    it('maps 401/unauthorized to AUTHENTICATION', () => {
      const err = ApiErrorHandler.normalizeError(new Error('Unauthorized'), 'x-api', {});
      expect(err.type).toBe(ErrorType.AUTHENTICATION);
    });

    it('maps 429/rate limit to RATE_LIMIT', () => {
      const err = ApiErrorHandler.normalizeError(new Error('Rate limit exceeded'), 'x-api', {});
      expect(err.type).toBe(ErrorType.RATE_LIMIT);
    });

    it('maps timeout to TIMEOUT', () => {
      const err = ApiErrorHandler.normalizeError(new Error('Request timeout'), 'x-api', {});
      expect(err.type).toBe(ErrorType.TIMEOUT);
    });

    it('attaches endpoint and userId from context', () => {
      const err = ApiErrorHandler.normalizeError(new Error('Fail'), 'apify', {
        endpoint: 'search',
        userId: 'u1',
      });
      expect(err.endpoint).toBe('search');
      expect(err.userId).toBe('u1');
    });
  });

  describe('createUserFriendlyMessage', () => {
    it('returns user-friendly message for AUTHENTICATION', () => {
      const err: ApiError = ApiErrorHandler.createError(
        ErrorType.AUTHENTICATION,
        'raw',
        'x-api',
        {}
      );
      expect(ApiErrorHandler.createUserFriendlyMessage(err)).toContain('credentials');
    });

    it('returns user-friendly message for RATE_LIMIT', () => {
      const err: ApiError = ApiErrorHandler.createError(
        ErrorType.RATE_LIMIT,
        'raw',
        'x-api',
        {}
      );
      expect(ApiErrorHandler.createUserFriendlyMessage(err)).toContain('wait');
    });

    it('returns generic message for UNKNOWN', () => {
      const err: ApiError = ApiErrorHandler.createError(
        ErrorType.UNKNOWN,
        'raw',
        'x-api',
        {}
      );
      expect(ApiErrorHandler.createUserFriendlyMessage(err)).toContain('unexpected');
    });
  });

  describe('executeWithRetry', () => {
    it('returns result on first success', async () => {
      const result = await ApiErrorHandler.executeWithRetry(
        async () => 'ok',
        'x-api',
        { maxRetries: 2, baseDelay: 1, maxDelay: 10, backoffMultiplier: 2, retryableErrors: [ErrorType.NETWORK_ERROR] },
        {}
      );
      expect(result).toBe('ok');
    });

    it('retries on retryable error then succeeds', async () => {
      let attempts = 0;
      const result = await ApiErrorHandler.executeWithRetry(
        async () => {
          attempts++;
          if (attempts < 2) throw new Error('timeout');
          return 'ok';
        },
        'x-api',
        { maxRetries: 3, baseDelay: 1, maxDelay: 10, backoffMultiplier: 2, retryableErrors: [ErrorType.TIMEOUT] },
        {}
      );
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    it('throws after max retries', async () => {
      try {
        await ApiErrorHandler.executeWithRetry(
          async () => {
            throw new Error('timeout');
          },
          'x-api',
          { maxRetries: 1, baseDelay: 1, maxDelay: 10, backoffMultiplier: 2, retryableErrors: [ErrorType.TIMEOUT] },
          {}
        );
      } catch (e: any) {
        expect(e.type).toBe(ErrorType.TIMEOUT);
        return;
      }
      expect(true).toBe(false);
    });
  });
});

describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker(2, 1000);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens after failureThreshold failures', async () => {
    const cb = new CircuitBreaker(2, 10000);
    await cb.execute(async () => {
      throw new Error('fail');
    }).catch(() => {});
    await cb.execute(async () => {
      throw new Error('fail');
    }).catch(() => {});
    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects when OPEN', async () => {
    const cb = new CircuitBreaker(1, 10000);
    await cb.execute(async () => {
      throw new Error('fail');
    }).catch(() => {});
    await expect(cb.execute(async () => 'ok')).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('resets on success', async () => {
    const cb = new CircuitBreaker(3, 10000);
    await cb.execute(async () => {
      throw new Error('fail');
    }).catch(() => {});
    await cb.execute(async () => 'ok');
    expect(cb.getState()).toBe('CLOSED');
  });
});

describe('ErrorMonitor', () => {
  it('returns singleton and records stats', () => {
    const monitor = ErrorMonitor.getInstance();
    monitor.resetCounts();
    const err: ApiError = ApiErrorHandler.createError(ErrorType.RATE_LIMIT, 'msg', 'x-api', {});
    monitor.recordError(err);
    monitor.recordError(err);
    const stats = monitor.getErrorStats();
    expect(stats['x-api-rate_limit']).toBe(2);
    monitor.resetCounts();
    expect(monitor.getErrorStats()).toEqual({});
  });
});
