import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType, Permission } from '@/lib/auth-types';
import { activityLoggingService } from '@/lib/activity-logging';
import { withRateLimit } from '@/lib/rate-limiting';
import { createRBACMiddleware } from '@/lib/rbac-framework';

const rbacMiddleware = createRBACMiddleware([Permission.VIEW_SYSTEM_LOGS]);

/**
 * GET /api/activity-logs/stats
 * Get activity log statistics and analytics
 * Requires VIEW_SYSTEM_LOGS permission
 */
export async function GET(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      
      // Parse query parameters
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const userId = searchParams.get('userId');

      // Get activity statistics
      const stats = await activityLoggingService.getActivityStats({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userId: userId || undefined
      });

      return NextResponse.json({ stats });

    } catch (error: any) {
      console.error('Error fetching activity log stats:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch activity log statistics') },
        { status: 500 }
      );
    }
  });
}
