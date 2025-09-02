'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAccountSettings } from '@/hooks/use-account-settings';
import { SessionInfo } from '@/lib/auth-types';
import { Loader2, Monitor, Smartphone, Tablet, Globe, MapPin, Calendar, Clock, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function SessionManagement() {
  const { sessions, revokeSession, loading } = useAccountSettings();
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceName = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Unknown Browser';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session? The user will be logged out immediately.')) {
      return;
    }

    setRevokingSession(sessionId);
    try {
      await revokeSession(sessionId);
      toast.success('Session revoked successfully');
    } catch (error) {
      toast.error('Failed to revoke session');
    } finally {
      setRevokingSession(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading sessions...</span>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center p-8">
        <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Active Sessions</h3>
        <p className="text-muted-foreground">
          You don't have any active sessions at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Notice:</strong> You can see all devices where you're currently logged in. 
          If you don't recognize a device, revoke the session immediately.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {sessions.map((session) => (
          <Card key={session.id} className={session.is_current ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getDeviceIcon(session.user_agent)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-sm">
                        {getDeviceName(session.user_agent)}
                      </h4>
                      {session.is_current && (
                        <Badge variant="secondary" className="text-xs">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Globe className="h-3 w-3" />
                        <span>{session.ip_address}</span>
                        {session.location && (
                          <>
                            <span>•</span>
                            <MapPin className="h-3 w-3" />
                            <span>{session.location}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {formatDate(session.created_at)}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>Last activity: {formatDate(session.last_activity)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  {!session.is_current && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingSession === session.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {revokingSession === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      <span className="ml-1">Revoke</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>
          You have {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
          {sessions.filter(s => s.is_current).length > 0 && ' (including this one)'}
        </p>
      </div>
    </div>
  );
}
