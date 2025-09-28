import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AuditLogEntry } from '@/lib/auth-types';

// Activity log levels for different types of events
export enum ActivityLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Activity categories for organizing logs
export enum ActivityCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  USER_MANAGEMENT = 'user_management',
  CONTENT_MANAGEMENT = 'content_management',
  SYSTEM_ADMINISTRATION = 'system_administration',
  SECURITY = 'security',
  DATA_ACCESS = 'data_access',
  API_USAGE = 'api_usage',
  PERMISSION_CHANGES = 'permission_changes',
  SESSION_MANAGEMENT = 'session_management'
}

// Enhanced activity log entry interface
export interface ActivityLogEntry extends Omit<AuditLogEntry, 'details'> {
  level: ActivityLevel;
  category: ActivityCategory;
  severity_score: number; // 1-10 scale for filtering critical events
  session_id?: string;
  request_id?: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
  retention_until?: string; // When this log should be deleted
}

// Activity logging configuration
export interface ActivityLogConfig {
  enablePerformanceLogging: boolean;
  enableDetailedLogging: boolean;
  logRetentionDays: number;
  criticalEventRetentionDays: number;
  maxLogSize: number;
  batchSize: number;
  flushInterval: number;
}

// Default configuration
const DEFAULT_CONFIG: ActivityLogConfig = {
  enablePerformanceLogging: true,
  enableDetailedLogging: true,
  logRetentionDays: 90, // 3 months
  criticalEventRetentionDays: 365, // 1 year
  maxLogSize: 10000, // Max entries per batch
  batchSize: 100,
  flushInterval: 5000 // 5 seconds
};

// Activity logging service class
export class ActivityLoggingService {
  private static instance: ActivityLoggingService;
  private config: ActivityLogConfig;
  private logBuffer: ActivityLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor(config: Partial<ActivityLogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startFlushTimer();
  }

  public static getInstance(config?: Partial<ActivityLogConfig>): ActivityLoggingService {
    if (!ActivityLoggingService.instance) {
      ActivityLoggingService.instance = new ActivityLoggingService(config);
    }
    return ActivityLoggingService.instance;
  }

  /**
   * Log an activity event
   */
  public async logActivity(
    userId: string,
    action: string,
    category: ActivityCategory,
    level: ActivityLevel = ActivityLevel.INFO,
    options: {
      resourceType?: string;
      resourceId?: string;
      details?: Record<string, any>;
      metadata?: Record<string, any>;
      sessionId?: string;
      requestId?: string;
      request?: NextRequest;
      severityScore?: number;
      retentionDays?: number;
    } = {}
  ): Promise<void> {
    try {
      const {
        resourceType,
        resourceId,
        details = {},
        metadata = {},
        sessionId,
        requestId,
        request,
        severityScore,
        retentionDays
      } = options;

      // Calculate severity score if not provided
      const calculatedSeverity = severityScore || this.calculateSeverityScore(level, category, action);

      // Calculate retention date
      const retentionDaysToUse = retentionDays || this.getRetentionDays(level);
      const retentionUntil = new Date();
      retentionUntil.setDate(retentionUntil.getDate() + retentionDaysToUse);

      // Extract request information
      const ipAddress = request?.headers.get('x-forwarded-for') || 
                       request?.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = request?.headers.get('user-agent') || 'unknown';

      const activityEntry: ActivityLogEntry = {
        user_id: userId,
        action,
        resource_type: resourceType || 'system',
        resource_id: resourceId,
        level,
        category,
        severity_score: calculatedSeverity,
        session_id: sessionId,
        request_id: requestId,
        details,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
        retention_until: retentionUntil.toISOString(),
        created_at: new Date().toISOString()
      };

      // Add to buffer for batch processing
      this.logBuffer.push(activityEntry);

      // Flush immediately for critical events
      if (level === ActivityLevel.CRITICAL) {
        await this.flushLogs();
      }

      // Flush if buffer is full
      if (this.logBuffer.length >= this.config.batchSize) {
        await this.flushLogs();
      }

    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  }

  /**
   * Log authentication events
   */
  public async logAuthEvent(
    userId: string,
    action: string,
    success: boolean,
    details: Record<string, any> = {},
    request?: NextRequest
  ): Promise<void> {
    const level = success ? ActivityLevel.INFO : ActivityLevel.WARNING;
    const severityScore = success ? 3 : 6;

    await this.logActivity(
      userId,
      action,
      ActivityCategory.AUTHENTICATION,
      level,
      {
        details: { ...details, success },
        request,
        severityScore
      }
    );
  }

  /**
   * Log permission/authorization events
   */
  public async logPermissionEvent(
    userId: string,
    action: string,
    permission: string,
    allowed: boolean,
    resourceType?: string,
    resourceId?: string,
    request?: NextRequest
  ): Promise<void> {
    const level = allowed ? ActivityLevel.INFO : ActivityLevel.WARNING;
    const severityScore = allowed ? 2 : 5;

    await this.logActivity(
      userId,
      action,
      ActivityCategory.AUTHORIZATION,
      level,
      {
        resourceType,
        resourceId,
        details: { permission, allowed },
        request,
        severityScore
      }
    );
  }

  /**
   * Log user management events
   */
  public async logUserManagementEvent(
    userId: string,
    action: string,
    targetUserId?: string,
    details: Record<string, any> = {},
    request?: NextRequest
  ): Promise<void> {
    const severityScore = this.getUserManagementSeverity(action);

    await this.logActivity(
      userId,
      action,
      ActivityCategory.USER_MANAGEMENT,
      ActivityLevel.INFO,
      {
        resourceType: 'user',
        resourceId: targetUserId,
        details,
        request,
        severityScore
      }
    );
  }

  /**
   * Log security events
   */
  public async logSecurityEvent(
    userId: string,
    action: string,
    threatLevel: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any> = {},
    request?: NextRequest
  ): Promise<void> {
    const level = threatLevel === 'critical' ? ActivityLevel.CRITICAL :
                  threatLevel === 'high' ? ActivityLevel.ERROR :
                  threatLevel === 'medium' ? ActivityLevel.WARNING :
                  ActivityLevel.INFO;

    const severityScore = threatLevel === 'critical' ? 10 :
                         threatLevel === 'high' ? 8 :
                         threatLevel === 'medium' ? 6 : 4;

    await this.logActivity(
      userId,
      action,
      ActivityCategory.SECURITY,
      level,
      {
        details: { ...details, threatLevel },
        request,
        severityScore
      }
    );
  }

  /**
   * Get activity logs with filtering and pagination
   */
  public async getActivityLogs(options: {
    userId?: string;
    category?: ActivityCategory;
    level?: ActivityLevel;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: string;
    endDate?: string;
    minSeverity?: number;
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{
    logs: ActivityLogEntry[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        userId,
        category,
        level,
        action,
        resourceType,
        resourceId,
        startDate,
        endDate,
        minSeverity,
        limit = 50,
        offset = 0,
        search
      } = options;

      let query = getSupabaseAdmin()
        .from('activity_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (userId) query = query.eq('user_id', userId);
      if (category) query = query.eq('category', category);
      if (level) query = query.eq('level', level);
      if (action) query = query.eq('action', action);
      if (resourceType) query = query.eq('resource_type', resourceType);
      if (resourceId) query = query.eq('resource_id', resourceId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      if (minSeverity) query = query.gte('severity_score', minSeverity);

      // Text search in action and details
      if (search) {
        query = query.or(`action.ilike.%${search}%,details::text.ilike.%${search}%`);
      }

      // Apply pagination and ordering
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        logs: data || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      console.error('Failed to get activity logs:', error);
      throw error;
    }
  }

  /**
   * Export activity logs
   */
  public async exportActivityLogs(options: {
    userId?: string;
    category?: ActivityCategory;
    level?: ActivityLevel;
    startDate?: string;
    endDate?: string;
    format: 'json' | 'csv';
  }): Promise<string> {
    try {
      const { format, ...filterOptions } = options;
      
      // Get all logs matching the criteria (no pagination for export)
      const { logs } = await this.getActivityLogs({
        ...filterOptions,
        limit: 10000 // Large limit for export
      });

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(logs);
      }

      throw new Error('Unsupported export format');

    } catch (error) {
      console.error('Failed to export activity logs:', error);
      throw error;
    }
  }

  /**
   * Clean up expired logs
   */
  public async cleanupExpiredLogs(): Promise<number> {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from('activity_logs')
        .delete()
        .lt('retention_until', new Date().toISOString())
        .select('id');

      if (error) {
        throw error;
      }

      return data?.length || 0;

    } catch (error) {
      console.error('Failed to cleanup expired logs:', error);
      return 0;
    }
  }

  /**
   * Get activity statistics
   */
  public async getActivityStats(options: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  } = {}): Promise<{
    totalEvents: number;
    eventsByCategory: Record<ActivityCategory, number>;
    eventsByLevel: Record<ActivityLevel, number>;
    criticalEvents: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    try {
      const { startDate, endDate, userId } = options;

      let query = getSupabaseAdmin()
        .from('activity_logs')
        .select('*');

      if (userId) query = query.eq('user_id', userId);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const logs = data || [];
      const totalEvents = logs.length;

      // Aggregate by category
      const eventsByCategory = logs.reduce((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
      }, {} as Record<ActivityCategory, number>);

      // Aggregate by level
      const eventsByLevel = logs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<ActivityLevel, number>);

      // Count critical events
      const criticalEvents = logs.filter(log => log.level === ActivityLevel.CRITICAL).length;

      // Top actions
      const actionCounts = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }));

      return {
        totalEvents,
        eventsByCategory,
        eventsByLevel,
        criticalEvents,
        topActions
      };

    } catch (error) {
      console.error('Failed to get activity stats:', error);
      throw error;
    }
  }

  // Private helper methods
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushLogs();
    }, this.config.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const logsToFlush = [...this.logBuffer];
      this.logBuffer = [];

      await getSupabaseAdmin()
        .from('activity_logs')
        .insert(logsToFlush);

    } catch (error) {
      console.error('Failed to flush activity logs:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  private calculateSeverityScore(level: ActivityLevel, category: ActivityCategory, action: string): number {
    let baseScore = 1;

    // Level scoring
    switch (level) {
      case ActivityLevel.CRITICAL: baseScore = 10; break;
      case ActivityLevel.ERROR: baseScore = 7; break;
      case ActivityLevel.WARNING: baseScore = 4; break;
      case ActivityLevel.INFO: baseScore = 1; break;
    }

    // Category adjustments
    if (category === ActivityCategory.SECURITY) baseScore += 2;
    if (category === ActivityCategory.AUTHORIZATION) baseScore += 1;

    // Action-specific adjustments
    if (action.includes('delete') || action.includes('remove')) baseScore += 1;
    if (action.includes('admin') || action.includes('system')) baseScore += 1;

    return Math.min(baseScore, 10);
  }

  private getRetentionDays(level: ActivityLevel): number {
    switch (level) {
      case ActivityLevel.CRITICAL:
        return this.config.criticalEventRetentionDays;
      case ActivityLevel.ERROR:
        return this.config.logRetentionDays * 2;
      default:
        return this.config.logRetentionDays;
    }
  }

  private getUserManagementSeverity(action: string): number {
    const highSeverityActions = ['delete_user', 'deactivate_user', 'change_role'];
    const mediumSeverityActions = ['create_user', 'update_user', 'reset_password'];

    if (highSeverityActions.some(a => action.includes(a))) return 8;
    if (mediumSeverityActions.some(a => action.includes(a))) return 5;
    return 3;
  }

  private convertToCSV(logs: ActivityLogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'id', 'user_id', 'action', 'level', 'category', 'resource_type', 'resource_id',
      'severity_score', 'session_id', 'request_id', 'ip_address', 'user_agent',
      'created_at', 'retention_until', 'details', 'metadata'
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id || '',
        log.user_id,
        `"${log.action}"`,
        log.level,
        log.category,
        log.resource_type,
        log.resource_id || '',
        log.severity_score,
        log.session_id || '',
        log.request_id || '',
        `"${log.ip_address || ''}"`,
        `"${log.user_agent || ''}"`,
        log.created_at,
        log.retention_until || '',
        `"${JSON.stringify(log.details).replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  /**
   * Cleanup method for graceful shutdown
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Flush remaining logs
    this.flushLogs();
  }
}

// Export singleton instance
export const activityLoggingService = ActivityLoggingService.getInstance();

// Convenience functions
export async function logActivity(
  userId: string,
  action: string,
  category: ActivityCategory,
  level: ActivityLevel = ActivityLevel.INFO,
  options?: Parameters<ActivityLoggingService['logActivity']>[4]
): Promise<void> {
  return activityLoggingService.logActivity(userId, action, category, level, options);
}

export async function logAuthEvent(
  userId: string,
  action: string,
  success: boolean,
  details?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  return activityLoggingService.logAuthEvent(userId, action, success, details, request);
}

export async function logPermissionEvent(
  userId: string,
  action: string,
  permission: string,
  allowed: boolean,
  resourceType?: string,
  resourceId?: string,
  request?: NextRequest
): Promise<void> {
  return activityLoggingService.logPermissionEvent(
    userId, action, permission, allowed, resourceType, resourceId, request
  );
}

export async function logUserManagementEvent(
  userId: string,
  action: string,
  targetUserId?: string,
  details?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  return activityLoggingService.logUserManagementEvent(
    userId, action, targetUserId, details, request
  );
}

export async function logSecurityEvent(
  userId: string,
  action: string,
  threatLevel: 'low' | 'medium' | 'high' | 'critical',
  details?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  return activityLoggingService.logSecurityEvent(
    userId, action, threatLevel, details, request
  );
}
