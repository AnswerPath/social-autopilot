import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType, Permission } from '@/lib/auth-types';
import { activityLoggingService } from '@/lib/activity-logging';
import { withRateLimit } from '@/lib/rate-limiting';
import { createRBACMiddleware } from '@/lib/rbac-framework';

const rbacMiddleware = createRBACMiddleware([Permission.VIEW_SYSTEM_LOGS]);

/**
 * GET /api/activity-logs
 * Fetch activity logs with filtering, pagination, and search
 * Requires VIEW_SYSTEM_LOGS permission
 */
export async function GET(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      
      // Parse query parameters
      const userId = searchParams.get('userId');
      const category = searchParams.get('category');
      const level = searchParams.get('level');
      const action = searchParams.get('action');
      const resourceType = searchParams.get('resourceType');
      const resourceId = searchParams.get('resourceId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const minSeverity = searchParams.get('minSeverity');
      const search = searchParams.get('search');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Validate parameters
      if (limit > 1000) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Limit cannot exceed 1000') },
          { status: 400 }
        );
      }

      if (offset < 0) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Offset must be non-negative') },
          { status: 400 }
        );
      }

      // Get activity logs
      const result = await activityLoggingService.getActivityLogs({
        userId: userId || undefined,
        category: category as any,
        level: level as any,
        action: action || undefined,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minSeverity: minSeverity ? parseInt(minSeverity) : undefined,
        limit,
        offset,
        search: search || undefined
      });

      return NextResponse.json({
        logs: result.logs,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: result.hasMore
        }
      });

    } catch (error: any) {
      console.error('Error fetching activity logs:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch activity logs') },
        { status: 500 }
      );
    }
  });
}

/**
 * POST /api/activity-logs
 * Create a new activity log entry (for system/internal use)
 * Requires VIEW_SYSTEM_LOGS permission
 */
export async function POST(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      const body = await req.json();
      const {
        userId: targetUserId,
        action,
        category,
        level = 'info',
        resourceType,
        resourceId,
        details,
        metadata,
        sessionId,
        requestId,
        severityScore
      } = body;

      // Validate required fields
      if (!targetUserId || !action || !category) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'userId, action, and category are required') },
          { status: 400 }
        );
      }

      // Log the activity
      await activityLoggingService.logActivity(
        targetUserId,
        action,
        category,
        level,
        {
          resourceType,
          resourceId,
          details,
          metadata,
          sessionId,
          requestId,
          severityScore,
          request: req
        }
      );

      return NextResponse.json({ success: true }, { status: 201 });

    } catch (error: any) {
      console.error('Error creating activity log:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create activity log') },
        { status: 500 }
      );
    }
  });
}
