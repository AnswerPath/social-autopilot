'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Activity, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface ErrorStats {
  [key: string]: number;
}

export function ErrorMonitoring() {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadErrorStats();
  }, []);

  const loadErrorStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/error-monitoring?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        toast.error('Failed to load error statistics');
      }
    } catch (error) {
      console.error('Error loading error stats:', error);
      toast.error('Failed to load error statistics');
    } finally {
      setLoading(false);
    }
  };

  const resetErrorCounts = async () => {
    try {
      const response = await fetch('/api/settings/error-monitoring?action=reset', {
        method: 'GET',
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('Error counts reset successfully');
        await loadErrorStats(); // Refresh stats
      } else {
        toast.error('Failed to reset error counts');
      }
    } catch (error) {
      console.error('Error resetting error counts:', error);
      toast.error('Failed to reset error counts');
    }
  };

  const testErrorRecording = async () => {
    try {
      const response = await fetch('/api/settings/error-monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorType: 'server_error',
          message: 'Test error for monitoring system',
          service: 'x-api',
          endpoint: 'test',
          userId: 'demo-user',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Test error recorded successfully');
        await loadErrorStats(); // Refresh stats
      } else {
        toast.error('Failed to record test error');
      }
    } catch (error) {
      console.error('Error recording test error:', error);
      toast.error('Failed to record test error');
    }
  };

  const getErrorSeverity = (errorKey: string): 'low' | 'medium' | 'high' | 'critical' => {
    if (errorKey.includes('authentication')) return 'high';
    if (errorKey.includes('rate_limit')) return 'medium';
    if (errorKey.includes('server_error') || errorKey.includes('service_unavailable')) return 'high';
    if (errorKey.includes('network_error') || errorKey.includes('timeout')) return 'medium';
    if (errorKey.includes('invalid_response')) return 'low';
    return 'medium';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Error Monitoring
          </CardTitle>
          <CardDescription>
            Monitoring API errors and system health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading error statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalErrors = stats ? Object.values(stats).reduce((sum, count) => sum + count, 0) : 0;
  const hasErrors = totalErrors > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Error Monitoring
        </CardTitle>
        <CardDescription>
          Monitor API errors, system health, and error patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total Errors:</span>
            <Badge variant={hasErrors ? 'destructive' : 'default'}>
              {totalErrors}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadErrorStats}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetErrorCounts}
            >
              Reset Counts
            </Button>
          </div>
        </div>

        {/* Error Statistics */}
        {stats && Object.keys(stats).length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Error Breakdown
            </h3>
            
            {Object.entries(stats).map(([errorKey, count]) => {
              const severity = getErrorSeverity(errorKey);
              const [service, errorType] = errorKey.split('-');
              
              return (
                <div key={errorKey} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(severity)}>
                      {severity.toUpperCase()}
                    </Badge>
                    <div>
                      <div className="font-medium">{service.toUpperCase()} - {errorType.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {count} occurrence{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-muted-foreground">No errors recorded</p>
            <p className="text-sm text-muted-foreground">System is running smoothly</p>
          </div>
        )}

        {/* Test Error Recording */}
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-3">Test Error Recording</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Test the error monitoring system by recording a test error
          </p>
          <Button
            variant="outline"
            onClick={testErrorRecording}
            className="w-full"
          >
            Record Test Error
          </Button>
        </div>

        {/* System Status */}
        <div className="pt-4 border-t">
          <h3 className="font-semibold mb-3">System Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm font-medium">Error Monitoring</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm font-medium">Circuit Breaker</div>
              <div className="text-xs text-muted-foreground">Ready</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
