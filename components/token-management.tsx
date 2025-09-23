'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Shield, ShieldX, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TokenManagementProps {
  userId: string;
}

interface TokenStatus {
  apify: {
    isValid: boolean;
    error?: string;
  };
  xApi: {
    isValid: boolean;
    error?: string;
  };
}

export function TokenManagement({ userId }: TokenManagementProps) {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    loadTokenStatus();
  }, [userId]);

  const loadTokenStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/token-management?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
      } else {
        toast.error('Failed to load token status');
      }
    } catch (error) {
      console.error('Error loading token status:', error);
      toast.error('Failed to load token status');
    } finally {
      setLoading(false);
    }
  };

  const performTokenAction = async (action: string, service: string) => {
    setRefreshing(`${action}-${service}`);
    try {
      const response = await fetch('/api/settings/token-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action,
          service,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`${action} completed successfully`);
        await loadTokenStatus(); // Refresh status
      } else {
        toast.error(data.result?.error || `Failed to ${action} ${service} token`);
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      toast.error(`Failed to ${action} ${service} token`);
    } finally {
      setRefreshing(null);
    }
  };

  const getStatusIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (isValid: boolean) => {
    return isValid ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Valid
      </Badge>
    ) : (
      <Badge variant="destructive">
        Invalid
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Token Management
          </CardTitle>
          <CardDescription>
            Managing API credentials and tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading token status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Token Management
        </CardTitle>
        <CardDescription>
          Manage and validate your API credentials for both Apify and X API services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status && (
          <>
            {/* Apify Token Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Apify API Key</h3>
                  {getStatusIcon(status.apify.isValid)}
                </div>
                {getStatusBadge(status.apify.isValid)}
              </div>
              
              {status.apify.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{status.apify.error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performTokenAction('validate', 'apify')}
                  disabled={refreshing === 'validate-apify'}
                >
                  {refreshing === 'validate-apify' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Validate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => performTokenAction('revoke', 'apify')}
                  disabled={refreshing === 'revoke-apify'}
                >
                  {refreshing === 'revoke-apify' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldX className="h-4 w-4" />
                  )}
                  Revoke
                </Button>
              </div>
            </div>

            {/* X API Token Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">X API Credentials</h3>
                  {getStatusIcon(status.xApi.isValid)}
                </div>
                {getStatusBadge(status.xApi.isValid)}
              </div>
              
              {status.xApi.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{status.xApi.error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performTokenAction('validate', 'x-api')}
                  disabled={refreshing === 'validate-x-api'}
                >
                  {refreshing === 'validate-x-api' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Validate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => performTokenAction('refresh', 'x-api')}
                  disabled={refreshing === 'refresh-x-api'}
                >
                  {refreshing === 'refresh-x-api' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => performTokenAction('revoke', 'x-api')}
                  disabled={refreshing === 'revoke-x-api'}
                >
                  {refreshing === 'revoke-x-api' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldX className="h-4 w-4" />
                  )}
                  Revoke
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overall Status:</span>
                <div className="flex gap-2">
                  {status.apify.isValid && status.xApi.isValid ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Fully Configured
                    </Badge>
                  ) : status.apify.isValid || status.xApi.isValid ? (
                    <Badge variant="secondary">
                      Partially Configured
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      Not Configured
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Refresh All Button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={loadTokenStatus}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh All Status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
