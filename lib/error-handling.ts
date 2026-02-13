/**
 * Comprehensive Error Handling System for API Downtime
 * Handles X API and Apify service failures with retry logic and fallbacks
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

export enum ErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  INVALID_RESPONSE = 'invalid_response',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ApiError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string | number;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  timestamp: string;
  service: 'x-api' | 'apify';
  endpoint?: string;
  userId?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

export interface FallbackConfig {
  enabled: boolean;
  fallbackService?: 'x-api' | 'apify';
  cacheEnabled: boolean;
  cacheDuration: number;
}

export class ApiErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableErrors: [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT,
      ErrorType.SERVER_ERROR,
      ErrorType.SERVICE_UNAVAILABLE,
    ],
  };

  private static readonly DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
    enabled: true,
    cacheEnabled: true,
    cacheDuration: 300000, // 5 minutes
  };

  /**
   * Create a standardized API error
   */
  static createError(
    type: ErrorType,
    message: string,
    service: 'x-api' | 'apify',
    options: {
      code?: string | number;
      retryable?: boolean;
      endpoint?: string;
      userId?: string;
    } = {}
  ): ApiError {
    const severity = this.getErrorSeverity(type);
    const retryable = options.retryable ?? this.isRetryableError(type);

    return {
      type,
      severity,
      message,
      code: options.code,
      retryable,
      timestamp: new Date().toISOString(),
      service,
      endpoint: options.endpoint,
      userId: options.userId,
    };
  }

  /**
   * Determine error severity based on error type
   */
  private static getErrorSeverity(type: ErrorType): ErrorSeverity {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return ErrorSeverity.HIGH;
      case ErrorType.RATE_LIMIT:
        return ErrorSeverity.MEDIUM;
      case ErrorType.SERVER_ERROR:
      case ErrorType.SERVICE_UNAVAILABLE:
        return ErrorSeverity.HIGH;
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT:
        return ErrorSeverity.MEDIUM;
      case ErrorType.INVALID_RESPONSE:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(type: ErrorType): boolean {
    return this.DEFAULT_RETRY_CONFIG.retryableErrors.includes(type);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(retryCount: number, config: RetryConfig = this.DEFAULT_RETRY_CONFIG): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Execute a function with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    service: 'x-api' | 'apify',
    config: RetryConfig = this.DEFAULT_RETRY_CONFIG,
    context: { endpoint?: string; userId?: string } = {}
  ): Promise<T> {
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const apiError = this.normalizeError(error, service, context);
        lastError = apiError;

        // Log the error
        this.logError(apiError, attempt);

        // Check if we should retry
        if (attempt === config.maxRetries || !apiError.retryable) {
          throw apiError;
        }

        // Wait before retrying
        const delay = this.calculateRetryDelay(attempt, config);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Normalize different error types into ApiError
   */
  static normalizeError(
    error: any,
    service: 'x-api' | 'apify',
    context: { endpoint?: string; userId?: string } = {}
  ): ApiError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Determine error type based on message and error properties
      let type = ErrorType.UNKNOWN;
      
      if (message.includes('authentication') || message.includes('unauthorized') || message.includes('401')) {
        type = ErrorType.AUTHENTICATION;
      } else if (message.includes('rate limit') || message.includes('429')) {
        type = ErrorType.RATE_LIMIT;
      } else if (message.includes('timeout') || message.includes('time out')) {
        type = ErrorType.TIMEOUT;
      } else if (message.includes('network') || message.includes('connection')) {
        type = ErrorType.NETWORK_ERROR;
      } else if (message.includes('server error') || message.includes('500')) {
        type = ErrorType.SERVER_ERROR;
      } else if (message.includes('service unavailable') || message.includes('503')) {
        type = ErrorType.SERVICE_UNAVAILABLE;
      } else if (message.includes('invalid response') || message.includes('malformed')) {
        type = ErrorType.INVALID_RESPONSE;
      }

      return this.createError(type, error.message, service, {
        endpoint: context.endpoint,
        userId: context.userId,
      });
    }

    // Handle non-Error objects
    return this.createError(
      ErrorType.UNKNOWN,
      String(error),
      service,
      {
        endpoint: context.endpoint,
        userId: context.userId,
      }
    );
  }

  /**
   * Log error with appropriate severity (structured) and send to Sentry
   */
  private static logError(error: ApiError, attempt: number): void {
    const payload = {
      service: error.service,
      type: error.type,
      severity: error.severity,
      attempt: attempt + 1,
      message: error.message,
      endpoint: error.endpoint,
      userId: error.userId,
    };
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.fatal(payload, 'API Error');
        break;
      case ErrorSeverity.HIGH:
        logger.error(payload, 'API Error');
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(payload, 'API Error');
        break;
      case ErrorSeverity.LOW:
        logger.info(payload, 'API Error');
        break;
      default:
        logger.warn(payload, 'API Error');
    }
    Sentry.withScope((scope) => {
      scope.setTag('service', error.service);
      scope.setTag('error_type', error.type);
      scope.setTag('severity', error.severity);
      scope.setContext('api_error', payload);
      if (error.userId) scope.setUser({ id: error.userId });
      const level = error.severity === ErrorSeverity.CRITICAL ? 'fatal' : error.severity === ErrorSeverity.HIGH ? 'error' : 'warning';
      Sentry.captureMessage(`API Error [${error.service}] ${error.type}: ${error.message}`, level);
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create user-friendly error message
   */
  static createUserFriendlyMessage(error: ApiError): string {
    switch (error.type) {
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please check your API credentials and try again.';
      case ErrorType.RATE_LIMIT:
        return 'Rate limit exceeded. Please wait a moment before trying again.';
      case ErrorType.SERVER_ERROR:
        return 'The service is experiencing issues. Please try again later.';
      case ErrorType.NETWORK_ERROR:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorType.SERVICE_UNAVAILABLE:
        return 'The service is temporarily unavailable. Please try again later.';
      case ErrorType.INVALID_RESPONSE:
        return 'Received an invalid response. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

/**
 * Circuit Breaker Pattern Implementation
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  /**
   * Reset the circuit breaker to CLOSED state (for recovery without app restart)
   */
  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

const MAX_REGISTERED_BREAKERS = 100;

/**
 * Registry of circuit breakers for admin reset without app restart
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers: CircuitBreaker[] = [];

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  register(breaker: CircuitBreaker): void {
    if (this.breakers.length >= MAX_REGISTERED_BREAKERS) {
      this.breakers.shift();
    }
    this.breakers.push(breaker);
  }

  resetAll(): number {
    let count = 0;
    for (const breaker of this.breakers) {
      try {
        breaker.reset();
        count++;
      } catch {
        // ignore
      }
    }
    return count;
  }

  getCount(): number {
    return this.breakers.length;
  }
}

/**
 * Error Monitoring and Alerting
 */
export class ErrorMonitor {
  private static instance: ErrorMonitor;
  private errorCounts: Map<string, number> = new Map();
  private alertThresholds: Map<ErrorSeverity, number> = new Map([
    [ErrorSeverity.CRITICAL, 1],
    [ErrorSeverity.HIGH, 5],
    [ErrorSeverity.MEDIUM, 10],
    [ErrorSeverity.LOW, 50],
  ]);

  static getInstance(): ErrorMonitor {
    if (!ErrorMonitor.instance) {
      ErrorMonitor.instance = new ErrorMonitor();
    }
    return ErrorMonitor.instance;
  }

  recordError(error: ApiError): void {
    const key = `${error.service}-${error.type}`;
    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Check if we should send an alert
    const threshold = this.alertThresholds.get(error.severity) || 0;
    if (count + 1 >= threshold) {
      this.sendAlert(error, count + 1);
    }
  }

  private sendAlert(error: ApiError, count: number): void {
    const message = `API Error Alert: ${error.service} - ${error.type} (${count} occurrences)`;
    logger.error(
      { service: error.service, type: error.type, severity: error.severity, count, message },
      'ErrorMonitor alert'
    );
    Sentry.withScope((scope) => {
      scope.setTag('service', error.service);
      scope.setTag('error_type', error.type);
      scope.setTag('severity', error.severity);
      scope.setContext('alert', { count, message });
      if (error.userId) scope.setUser({ id: error.userId });
      Sentry.captureMessage(message, 'error');
    });
  }

  getErrorStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.errorCounts.forEach((count, key) => {
      stats[key] = count;
    });
    return stats;
  }

  resetCounts(): void {
    this.errorCounts.clear();
  }
}
