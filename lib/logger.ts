/**
 * Structured JSON logger for observability and analysis.
 * Uses Pino; supports requestId, userId, service, and standard levels.
 */

import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  service?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

/**
 * Create a child logger with bound context (requestId, userId, service).
 * Use this in API routes and services so all log lines carry context.
 */
export function createLogger(context: LogContext = {}): pino.Logger {
  return baseLogger.child(context);
}

/**
 * Default logger when no request context is available (e.g. scripts, startup).
 */
export const logger = baseLogger;

/**
 * Generate a request ID (e.g. for use in middleware or route handlers).
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
