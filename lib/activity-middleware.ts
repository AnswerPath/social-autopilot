import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { logActivity, ActivityCategory, ActivityLevel } from '@/lib/activity-logging';

/**
 * Middleware to automatically log API requests and responses
 */
export function withActivityLogging(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    let user = null;
    let response: NextResponse;

    try {
      // Get current user if authenticated
      try {
        user = await getCurrentUser(request);
      } catch (error) {
        // User not authenticated, continue without logging user
      }

      // Execute the original handler
      response = await handler(request);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Log the API request
      await logApiRequest(request, response, user, processingTime);

    } catch (error) {
      // Calculate processing time for errors
      const processingTime = Date.now() - startTime;

      // Log the error
      await logApiError(request, error, user, processingTime);

      // Re-throw the error
      throw error;
    }

    return response;
  };
}

/**
 * Log successful API requests
 */
async function logApiRequest(
  request: NextRequest,
  response: NextResponse,
  user: any,
  processingTime: number
): Promise<void> {
  try {
    const url = new URL(request.url);
    const method = request.method;
    const statusCode = response.status;
    const pathname = url.pathname;

    // Determine category based on path
    const category = getCategoryFromPath(pathname);
    
    // Determine level based on status code
    const level = getLevelFromStatusCode(statusCode);

    // Create action description
    const action = `${method} ${pathname}`;

    // Create details object
    const details = {
      method,
      pathname,
      statusCode,
      processingTimeMs: processingTime,
      queryParams: Object.fromEntries(url.searchParams),
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer')
    };

    // Log for authenticated users
    if (user) {
      await logActivity(
        user.id,
        action,
        category,
        level,
        {
          resourceType: 'api_endpoint',
          resourceId: pathname,
          details,
          request
        }
      );
    } else {
      // Log anonymous requests with system user ID
      await logActivity(
        'anonymous',
        action,
        category,
        level,
        {
          resourceType: 'api_endpoint',
          resourceId: pathname,
          details,
          request
        }
      );
    }

  } catch (error) {
    console.error('Failed to log API request:', error);
    // Don't throw - logging should not break the main flow
  }
}

/**
 * Log API errors
 */
async function logApiError(
  request: NextRequest,
  error: any,
  user: any,
  processingTime: number
): Promise<void> {
  try {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Determine category based on path
    const category = getCategoryFromPath(pathname);
    
    // Determine level based on error type
    const level = getLevelFromError(error);

    // Create action description
    const action = `${method} ${pathname} (ERROR)`;

    // Create details object
    const details = {
      method,
      pathname,
      error: error.message || 'Unknown error',
      errorType: error.constructor.name,
      processingTimeMs: processingTime,
      queryParams: Object.fromEntries(url.searchParams),
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer')
    };

    // Log for authenticated users
    if (user) {
      await logActivity(
        user.id,
        action,
        category,
        level,
        {
          resourceType: 'api_endpoint',
          resourceId: pathname,
          details,
          request
        }
      );
    } else {
      // Log anonymous errors with system user ID
      await logActivity(
        'anonymous',
        action,
        category,
        level,
        {
          resourceType: 'api_endpoint',
          resourceId: pathname,
          details,
          request
        }
      );
    }

  } catch (logError) {
    console.error('Failed to log API error:', logError);
    // Don't throw - logging should not break the main flow
  }
}

/**
 * Determine activity category based on API path
 */
function getCategoryFromPath(pathname: string): ActivityCategory {
  if (pathname.includes('/auth/')) {
    return ActivityCategory.AUTHENTICATION;
  } else if (pathname.includes('/permissions/') || pathname.includes('/roles/')) {
    return ActivityCategory.AUTHORIZATION;
  } else if (pathname.includes('/users/')) {
    return ActivityCategory.USER_MANAGEMENT;
  } else if (pathname.includes('/activity-logs/')) {
    return ActivityCategory.SYSTEM_ADMINISTRATION;
  } else if (pathname.includes('/security/') || pathname.includes('/audit/')) {
    return ActivityCategory.SECURITY;
  } else if (pathname.includes('/api/')) {
    return ActivityCategory.API_USAGE;
  } else {
    return ActivityCategory.SYSTEM_ADMINISTRATION;
  }
}

/**
 * Determine activity level based on HTTP status code
 */
function getLevelFromStatusCode(statusCode: number): ActivityLevel {
  if (statusCode >= 500) {
    return ActivityLevel.ERROR;
  } else if (statusCode >= 400) {
    return ActivityLevel.WARNING;
  } else if (statusCode >= 200) {
    return ActivityLevel.INFO;
  } else {
    return ActivityLevel.INFO;
  }
}

/**
 * Determine activity level based on error type
 */
function getLevelFromError(error: any): ActivityLevel {
  if (error.message?.includes('unauthorized') || error.message?.includes('forbidden')) {
    return ActivityLevel.WARNING;
  } else if (error.message?.includes('not found')) {
    return ActivityLevel.INFO;
  } else {
    return ActivityLevel.ERROR;
  }
}

/**
 * Middleware specifically for authentication-related endpoints
 */
export function withAuthActivityLogging(handler: (req: NextRequest) => Promise<NextResponse>) {
  return withActivityLogging(handler);
}

/**
 * Middleware specifically for user management endpoints
 */
export function withUserManagementActivityLogging(handler: (req: NextRequest) => Promise<NextResponse>) {
  return withActivityLogging(handler);
}

/**
 * Middleware specifically for security-sensitive endpoints
 */
export function withSecurityActivityLogging(handler: (req: NextRequest) => Promise<NextResponse>) {
  return withActivityLogging(handler);
}
