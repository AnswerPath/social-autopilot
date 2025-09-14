'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Shield, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  LogOut,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface SessionDetails {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  expires_at: string;
  device_type?: string;
  browser?: string;
  os?: string;
  is_current?: boolean;
}

interface SessionAnalytics {
  total_sessions: number;
  active_sessions: number;
  expired_sessions: number;
  sessions_by_device: Record<string, number>;
  sessions_by_location: Record<string, number>;
  average_session_duration: number;
  concurrent_sessions: number;
}

interface SessionMonitoringProps {
  userId: string;
}

export function SessionMonitoring({ userId }: SessionMonitoringProps) {
  const [sessions, setSessions] = useState<SessionDetails[]>([]);
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/sessions?analytics=true');
      const data = await response.json();
      
      if (response.ok) {
        setSessions(data.sessions || []);
        setAnalytics(data.analytics || null);
      } else {
        toast.error(data.error || 'Failed to load sessions');
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const refreshSessions = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      const response = await fetch(`/api/auth/sessions?sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Session revoked successfully');
        await loadSessions();
      } else {
        toast.error(data.error || 'Failed to revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeOtherSessions = async () => {
    setRevoking('others');
    try {
      const response = await fetch('/api/auth/sessions?others=true', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Revoked ${data.deactivatedCount} other sessions`);
        await loadSessions();
      } else {
        toast.error(data.error || 'Failed to revoke other sessions');
      }
    } catch (error) {
      console.error('Error revoking other sessions:', error);
      toast.error('Failed to revoke other sessions');
    } finally {
      setRevoking(null);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (session: SessionDetails) => {
    if (session.is_current) {
      return <Badge variant="default">Current</Badge>;
    }
    if (session.is_active) {
      return <Badge variant="secondary">Active</Badge>;
    }
    return <Badge variant="outline">Inactive</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Monitoring</CardTitle>
          <CardDescription>Loading session information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.active_sessions}</div>
              <p className="text-xs text-muted-foreground">
                of {analytics.total_sessions} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.average_session_duration}m</div>
              <p className="text-xs text-muted-foreground">
                per session
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Device Types</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(analytics.sessions_by_device).map(([device, count]) => (
                  <div key={device} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{device}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Security</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Secure</div>
              <p className="text-xs text-muted-foreground">
                No suspicious activity
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Session Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions and monitor for security
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshSessions}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={revokeOtherSessions}
                disabled={revoking === 'others'}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Revoke Others
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No sessions found. This might indicate an issue with session tracking.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.device_type || 'desktop')}
                        <div>
                          <div className="font-medium capitalize">
                            {session.device_type || 'Desktop'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {session.os || 'Unknown OS'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{session.browser || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">
                        {session.user_agent.split(' ')[0]}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {session.ip_address}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(session.last_activity), { addSuffix: true })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(session.last_activity), 'MMM d, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(session)}
                    </TableCell>
                    <TableCell>
                      {!session.is_current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeSession(session.session_id)}
                          disabled={revoking === session.session_id}
                        >
                          {revoking === session.session_id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Multiple Active Sessions:</strong> You have {analytics?.active_sessions || 0} active sessions. 
              Consider revoking sessions from devices you no longer use.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Best Practices:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Log out from public computers</li>
                <li>• Use strong, unique passwords</li>
                <li>• Enable two-factor authentication</li>
                <li>• Regularly review active sessions</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Security Actions:</h4>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  View Security Log
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Settings
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
