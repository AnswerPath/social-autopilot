'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Activity, Database, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface HealthData {
  success: boolean;
  db?: {
    success?: boolean;
    tableExists?: boolean;
    canRead?: boolean;
    canWrite?: boolean;
    recordCount?: number;
    error?: string;
  };
  stats?: Record<string, number>;
  circuitBreaker?: { note: string };
}

function AdminHealthContent() {
  const router = useRouter();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const res = await fetch('/api/admin/health');
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
      if (!json.success) toast.error('Failed to load health data');
    } catch {
      toast.error('Failed to load health data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (forbidden) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-6">Only administrators can view system health.</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const db = data?.db;
  const stats = data?.stats ?? {};
  const totalErrors = Object.values(stats).reduce((s, n) => s + n, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
            <p className="text-gray-600">Database, errors, and monitoring overview</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database
              </CardTitle>
              <CardDescription>Connection and table status</CardDescription>
            </CardHeader>
            <CardContent>
              {db?.success !== false ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={db?.tableExists ? 'default' : 'destructive'}>
                      {db?.tableExists ? 'Tables OK' : 'Missing'}
                    </Badge>
                    <Badge variant={db?.canRead ? 'default' : 'destructive'}>
                      {db?.canRead ? 'Read OK' : 'Read failed'}
                    </Badge>
                    <Badge variant={db?.canWrite ? 'default' : 'destructive'}>
                      {db?.canWrite ? 'Write OK' : 'Write failed'}
                    </Badge>
                  </div>
                  {typeof db?.recordCount === 'number' && (
                    <p className="text-sm text-muted-foreground">Records (scheduled_posts): {db.recordCount}</p>
                  )}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>{db?.error ?? 'Database health check failed'}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Error counts
              </CardTitle>
              <CardDescription>In-memory error stats (X API / Apify)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Total:</span>
                <Badge variant={totalErrors > 0 ? 'destructive' : 'secondary'}>{totalErrors}</Badge>
              </div>
              {Object.keys(stats).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(stats).map(([key, count]) => (
                    <li key={key} className="flex justify-between text-sm">
                      <span className="font-mono">{key}</span>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No errors recorded</p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Circuit breaker: {data?.circuitBreaker?.note ?? 'Per client instance.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Monitoring
              </CardTitle>
              <CardDescription>APM and error tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Sentry and performance monitoring are configured when DSN is set. See{' '}
                <Link href="/dashboard" className="text-primary underline">
                  Settings
                </Link>{' '}
                for error monitoring UI.
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                <li>APM & thresholds: docs/APM_AND_MONITORING.md</li>
                <li>Alerting: docs/ALERTING_AND_ESCALATION.md</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AdminHealthPage() {
  return (
    <ProtectedRoute>
      <AdminHealthContent />
    </ProtectedRoute>
  );
}
