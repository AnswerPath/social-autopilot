'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './use-auth';
import { ActivityLogEntry, ActivityCategory, ActivityLevel } from '@/lib/activity-logging';

export interface ActivityLogFilters {
  userId?: string;
  category?: ActivityCategory;
  level?: ActivityLevel;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  minSeverity?: number;
  search?: string;
}

export interface ActivityLogStats {
  totalEvents: number;
  eventsByCategory: Record<ActivityCategory, number>;
  eventsByLevel: Record<ActivityLevel, number>;
  criticalEvents: number;
  topActions: Array<{ action: string; count: number }>;
}

export interface ActivityLogsResponse {
  logs: ActivityLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ExportRequest {
  userId?: string;
  category?: ActivityCategory;
  level?: ActivityLevel;
  startDate?: string;
  endDate?: string;
  format: 'json' | 'csv';
}

export function useActivityLogs() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<ActivityLogStats | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });

  const fetchActivityLogs = useCallback(async (
    filters: ActivityLogFilters = {},
    paginationOptions: { limit?: number; offset?: number } = {}
  ) => {
    if (!isAuthenticated || !user) {
      setError('User not authenticated.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      // Add filters
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.category) params.append('category', filters.category);
      if (filters.level) params.append('level', filters.level);
      if (filters.action) params.append('action', filters.action);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      if (filters.resourceId) params.append('resourceId', filters.resourceId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minSeverity) params.append('minSeverity', filters.minSeverity.toString());
      if (filters.search) params.append('search', filters.search);

      // Add pagination
      const limit = paginationOptions.limit || 50;
      const offset = paginationOptions.offset || 0;
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activity logs: ${response.statusText}`);
      }

      const data: ActivityLogsResponse = await response.json();
      
      setLogs(data.logs);
      setPagination(data.pagination);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch activity logs.');
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const fetchActivityStats = useCallback(async (filters: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  } = {}) => {
    if (!isAuthenticated || !user) {
      setError('User not authenticated.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.userId) params.append('userId', filters.userId);

      const response = await fetch(`/api/activity-logs/stats?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activity stats: ${response.statusText}`);
      }

      const data = await response.json();
      setStats(data.stats);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch activity stats.');
      console.error('Error fetching activity stats:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const exportActivityLogs = useCallback(async (exportRequest: ExportRequest) => {
    if (!isAuthenticated || !user) {
      setError('User not authenticated.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/activity-logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to export activity logs: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (err: any) {
      setError(err.message || 'Failed to export activity logs.');
      console.error('Error exporting activity logs:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const cleanupExpiredLogs = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/activity-logs/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to cleanup expired logs: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Refresh the logs after cleanup
      await fetchActivityLogs();
      
      return data.success;

    } catch (err: any) {
      setError(err.message || 'Failed to cleanup expired logs.');
      console.error('Error cleaning up expired logs:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, fetchActivityLogs]);

  const loadMoreLogs = useCallback(async (filters: ActivityLogFilters = {}) => {
    if (!pagination.hasMore) return;

    const newOffset = pagination.offset + pagination.limit;
    await fetchActivityLogs(filters, { 
      limit: pagination.limit, 
      offset: newOffset 
    });
  }, [pagination, fetchActivityLogs]);

  const refreshLogs = useCallback(async (filters: ActivityLogFilters = {}) => {
    await fetchActivityLogs(filters, { 
      limit: pagination.limit, 
      offset: 0 
    });
  }, [fetchActivityLogs, pagination.limit]);

  // Auto-refresh stats when component mounts
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchActivityStats();
    }
  }, [isAuthenticated, user, fetchActivityStats]);

  return {
    logs,
    stats,
    pagination,
    loading: loading || isAuthLoading,
    error,
    fetchActivityLogs,
    fetchActivityStats,
    exportActivityLogs,
    cleanupExpiredLogs,
    loadMoreLogs,
    refreshLogs,
    isAuthenticated,
    user
  };
}
