import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType, Permission } from '@/lib/auth-types';
import { activityLoggingService } from '@/lib/activity-logging';
import { withRateLimit } from '@/lib/rate-limiting';
import { createRBACMiddleware } from '@/lib/rbac-framework';
import { getSupabaseAdmin } from '@/lib/supabase';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const rbacMiddleware = createRBACMiddleware([Permission.VIEW_SYSTEM_LOGS]);

/**
 * POST /api/activity-logs/export
 * Export activity logs in JSON or CSV format
 * Requires VIEW_SYSTEM_LOGS permission
 */
export async function POST(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      const body = await req.json();
      const {
        userId,
        category,
        level,
        startDate,
        endDate,
        format = 'json'
      } = body;

      // Validate format
      if (!['json', 'csv'].includes(format)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Format must be json or csv') },
          { status: 400 }
        );
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `activity-logs-${timestamp}.${format}`;
      const filepath = join(tmpdir(), filename);

      // Export logs
      const exportData = await activityLoggingService.exportActivityLogs({
        userId,
        category,
        level,
        startDate,
        endDate,
        format
      });

      // Write to temporary file
      await writeFile(filepath, exportData);

      // Create export record in database
      const { data: exportRecord, error: dbError } = await getSupabaseAdmin()
        .from('activity_log_exports')
        .insert({
          user_id: user.id,
          export_type: format,
          filters: {
            userId,
            category,
            level,
            startDate,
            endDate
          },
          record_count: exportData.split('\n').length - 1, // Approximate count
          file_size_bytes: Buffer.byteLength(exportData),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error creating export record:', dbError);
      }

      // For now, return the data directly
      // In production, you'd want to store the file in cloud storage and return a download URL
      return NextResponse.json({
        success: true,
        filename,
        data: format === 'json' ? JSON.parse(exportData) : exportData,
        recordCount: exportRecord?.record_count,
        expiresAt: exportRecord?.expires_at
      });

    } catch (error: any) {
      console.error('Error exporting activity logs:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to export activity logs') },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/activity-logs/export
 * Get list of available exports for the user
 * Requires VIEW_SYSTEM_LOGS permission
 */
export async function GET(request: NextRequest) {
  return rbacMiddleware(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Get user's export history
      const { data: exports, error } = await getSupabaseAdmin()
        .from('activity_log_exports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return NextResponse.json({ exports });

    } catch (error: any) {
      console.error('Error fetching export history:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch export history') },
        { status: 500 }
      );
    }
  });
}
