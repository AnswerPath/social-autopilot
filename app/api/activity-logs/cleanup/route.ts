import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType, Permission } from '@/lib/auth-types';
import { activityLoggingService } from '@/lib/activity-logging';
import { withRateLimit } from '@/lib/rate-limiting';
import { createRBACMiddleware } from '@/lib/rbac-framework';

const rbacMiddleware = createRBACMiddleware([Permission.MANAGE_APP_SETTINGS]);

/**
 * POST /api/activity-logs/cleanup
 * Clean up expired activity logs
 * Requires MANAGE_APP_SETTINGS permission
 */
export async function POST(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      // Perform cleanup
      const deletedCount = await activityLoggingService.cleanupExpiredLogs();

      // Log the cleanup action
      await activityLoggingService.logUserManagementEvent(
        user.id,
        'cleanup_expired_logs',
        undefined,
        { deletedCount },
        request
      );

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} expired log entries`
      });

    } catch (error: any) {
      console.error('Error cleaning up activity logs:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to cleanup activity logs') },
        { status: 500 }
      );
    }
  });
}
