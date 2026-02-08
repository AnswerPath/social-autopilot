/**
 * Global API error wrapper for App Router route handlers.
 * Catches errors, normalizes with ApiErrorHandler, records to ErrorMonitor and Sentry,
 * returns consistent JSON and status, uses createUserFriendlyMessage for client-facing message.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import {
  ApiErrorHandler,
  ErrorMonitor,
  ErrorType,
  type ApiError,
} from '@/lib/error-handling';
import { createLogger } from '@/lib/logger';

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with global error handling.
 * Use in route.ts: export const POST = withApiErrorHandler(async (request) => { ... })
 */
export function withApiErrorHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const requestId = request.headers.get('x-request-id') ?? undefined;
    const log = createLogger({ requestId, service: 'api' });
    try {
      return await handler(request, context);
    } catch (error: unknown) {
      const apiError = normalizeToApiError(error);
      ErrorMonitor.getInstance().recordError(apiError);
      Sentry.withScope((scope) => {
        scope.setTag('service', apiError.service);
        scope.setTag('error_type', apiError.type);
        scope.setTag('severity', apiError.severity);
        scope.setContext('api_error', apiError as Record<string, unknown>);
        if (apiError.userId) scope.setUser({ id: apiError.userId });
        if (error instanceof Error) Sentry.captureException(error);
        else Sentry.captureMessage(apiError.message, 'error');
      });
      log.error({ err: error, apiError }, 'API route error');
      const status = statusFromError(apiError);
      const clientMessage = ApiErrorHandler.createUserFriendlyMessage(apiError);
      return NextResponse.json(
        { error: clientMessage, requestId: requestId || undefined },
        { status }
      );
    }
  };
}

function normalizeToApiError(error: unknown): ApiError {
  if (error && typeof error === 'object' && 'type' in error && 'service' in error) {
    return error as ApiError;
  }
  return ApiErrorHandler.normalizeError(
    error instanceof Error ? error : new Error(String(error)),
    'x-api',
    {}
  );
}

function statusFromError(error: ApiError): number {
  switch (error.type) {
    case ErrorType.AUTHENTICATION:
      return 401;
    case ErrorType.RATE_LIMIT:
      return 429;
    case ErrorType.SERVER_ERROR:
    case ErrorType.SERVICE_UNAVAILABLE:
      return 503;
    case ErrorType.NETWORK_ERROR:
    case ErrorType.TIMEOUT:
      return 502;
    default:
      return 500;
  }
}
