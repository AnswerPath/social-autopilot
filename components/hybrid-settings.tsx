'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, Key, Trash2, TestTube, Twitter, Bot } from 'lucide-react';

interface HybridSettingsProps {
  userId: string;
}

export function HybridSettings({ userId }: HybridSettingsProps) {
  // Apify state
  const [apifyApiKey, setApifyApiKey] = useState('');
  const [hasApifyCredentials, setHasApifyCredentials] = useState(false);
  const [apifyMessage, setApifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isApifyTesting, setIsApifyTesting] = useState(false);
  const [apifyTestResult, setApifyTestResult] = useState<{ success: boolean; message: string; actorCount?: number } | null>(null);
  const [isApifyLoading, setIsApifyLoading] = useState(false);

  // X API state
  const [xApiKey, setXApiKey] = useState('');
  const [xApiKeySecret, setXApiKeySecret] = useState('');
  const [xAccessToken, setXAccessToken] = useState('');
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState('');
  const [hasXApiCredentials, setHasXApiCredentials] = useState(false);
  const [xApiMessage, setXApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isXApiTesting, setIsXApiTesting] = useState(false);
  const [xApiTestResult, setXApiTestResult] = useState<{ success: boolean; message: string; user?: any } | null>(null);
  const [isXApiLoading, setIsXApiLoading] = useState(false);

  useEffect(() => {
    checkExistingCredentials();
  }, [userId]);

  const checkExistingCredentials = async () => {
    try {
      // Check Apify credentials
      const apifyResponse = await fetch(`/api/settings/apify-credentials?userId=${userId}`);
      if (apifyResponse.ok) {
        const apifyData = await apifyResponse.json();
        setHasApifyCredentials(apifyData.hasCredentials);
      }

      // Check X API credentials
      const xApiResponse = await fetch(`/api/settings/x-api-credentials?userId=${userId}`);
      if (xApiResponse.ok) {
        const xApiData = await xApiResponse.json();
        setHasXApiCredentials(xApiData.hasCredentials);
      }
    } catch (error) {
      console.error('Error checking existing credentials:', error);
    }
  };

  // Apify functions
  const testApifyConnection = async () => {
    if (!apifyApiKey.trim()) {
      setApifyMessage({ type: 'error', text: 'Please enter an API key to test' });
      return;
    }

    setIsApifyTesting(true);
    setApifyTestResult(null);
    setApifyMessage(null);

    try {
      const response = await fetch('/api/settings/test-apify-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apifyApiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setApifyTestResult({
          success: true,
          message: data.message,
          actorCount: data.actorCount,
        });
        setApifyMessage({ type: 'success', text: 'Connection test successful!' });
      } else {
        setApifyTestResult({
          success: false,
          message: data.error,
        });
        setApifyMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setApifyTestResult({
        success: false,
        message: 'Network error occurred',
      });
      setApifyMessage({ type: 'error', text: 'Network error occurred while testing connection' });
    } finally {
      setIsApifyTesting(false);
    }
  };

  const saveApifyCredentials = async () => {
    if (!apifyApiKey.trim()) {
      setApifyMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setIsApifyLoading(true);
    setApifyMessage(null);

    try {
      const response = await fetch('/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, apiKey: apifyApiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setApifyMessage({ type: 'success', text: 'Apify credentials saved successfully!' });
        setHasApifyCredentials(true);
        setApifyApiKey(''); // Clear the input for security
        setApifyTestResult(null);
      } else {
        setApifyMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setApifyMessage({ type: 'error', text: 'Failed to save credentials. Please try again.' });
    } finally {
      setIsApifyLoading(false);
    }
  };

  const deleteApifyCredentials = async () => {
    if (!confirm('Are you sure you want to delete your Apify credentials? This action cannot be undone.')) {
      return;
    }

    setIsApifyLoading(true);
    setApifyMessage(null);

    try {
      const response = await fetch(`/api/settings/apify-credentials?userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setApifyMessage({ type: 'success', text: 'Apify credentials deleted successfully!' });
        setHasApifyCredentials(false);
        setApifyTestResult(null);
      } else {
        setApifyMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setApifyMessage({ type: 'error', text: 'Failed to delete credentials. Please try again.' });
    } finally {
      setIsApifyLoading(false);
    }
  };

  // X API functions
  const testXApiConnection = async () => {
    if (!xApiKey.trim() || !xApiKeySecret.trim() || !xAccessToken.trim() || !xAccessTokenSecret.trim()) {
      setXApiMessage({ type: 'error', text: 'Please enter all X API credentials to test' });
      return;
    }

    setIsXApiTesting(true);
    setXApiTestResult(null);
    setXApiMessage(null);

    try {
      const response = await fetch('/api/settings/test-x-api-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: xApiKey.trim(),
          apiKeySecret: xApiKeySecret.trim(),
          accessToken: xAccessToken.trim(),
          accessTokenSecret: xAccessTokenSecret.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setXApiTestResult({
          success: true,
          message: data.message,
          user: data.user,
        });
        setXApiMessage({ type: 'success', text: 'Connection test successful!' });
      } else {
        setXApiTestResult({
          success: false,
          message: data.error,
        });
        setXApiMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setXApiTestResult({
        success: false,
        message: 'Network error occurred',
      });
      setXApiMessage({ type: 'error', text: 'Network error occurred while testing connection' });
    } finally {
      setIsXApiTesting(false);
    }
  };

  const saveXApiCredentials = async () => {
    if (!xApiKey.trim() || !xApiKeySecret.trim() || !xAccessToken.trim() || !xAccessTokenSecret.trim()) {
      setXApiMessage({ type: 'error', text: 'Please enter all X API credentials' });
      return;
    }

    setIsXApiLoading(true);
    setXApiMessage(null);

    try {
      const response = await fetch('/api/settings/x-api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          apiKey: xApiKey.trim(),
          apiKeySecret: xApiKeySecret.trim(),
          accessToken: xAccessToken.trim(),
          accessTokenSecret: xAccessTokenSecret.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setXApiMessage({ type: 'success', text: 'X API credentials saved successfully!' });
        setHasXApiCredentials(true);
        setXApiKey(''); // Clear inputs for security
        setXApiKeySecret('');
        setXAccessToken('');
        setXAccessTokenSecret('');
        setXApiTestResult(null);
      } else {
        setXApiMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setXApiMessage({ type: 'error', text: 'Failed to save credentials. Please try again.' });
    } finally {
      setIsXApiLoading(false);
    }
  };

  const deleteXApiCredentials = async () => {
    if (!confirm('Are you sure you want to delete your X API credentials? This action cannot be undone.')) {
      return;
    }

    setIsXApiLoading(true);
    setXApiMessage(null);

    try {
      const response = await fetch(`/api/settings/x-api-credentials?userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setXApiMessage({ type: 'success', text: 'X API credentials deleted successfully!' });
        setHasXApiCredentials(false);
        setXApiTestResult(null);
      } else {
        setXApiMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setXApiMessage({ type: 'error', text: 'Failed to delete credentials. Please try again.' });
    } finally {
      setIsXApiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Apify Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Apify Integration (Data Scraping)
          </CardTitle>
          <CardDescription>
            Configure your Apify API key for automated data scraping and monitoring using the watcher.data/search-x-by-keywords actor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apifyMessage && (
            <Alert className={apifyMessage.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={apifyMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {apifyMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {apifyTestResult && (
            <Alert className={apifyTestResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={apifyTestResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="flex items-center gap-2">
                  {apifyTestResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span className="font-medium">Connection Test Result:</span>
                </div>
                <p className="mt-1">{apifyTestResult.message}</p>
                {apifyTestResult.success && apifyTestResult.actorCount !== undefined && (
                  <div className="mt-1 text-sm">
                    Available actors: <Badge variant="secondary">{apifyTestResult.actorCount}</Badge>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="apify-api-key">Apify API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apify-api-key"
                type="password"
                placeholder="Enter your Apify API key"
                value={apifyApiKey}
                onChange={(e) => setApifyApiKey(e.target.value)}
                disabled={isApifyLoading}
              />
              <Button
                onClick={testApifyConnection}
                disabled={isApifyLoading || !apifyApiKey.trim()}
                variant="outline"
                size="sm"
              >
                {isApifyTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Test
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Get your API key from{' '}
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Apify Console
              </a>
            </p>
          </div>

          <div className="flex gap-2">
            {!hasApifyCredentials ? (
              <Button onClick={saveApifyCredentials} disabled={isApifyLoading || !apifyApiKey.trim()}>
                {isApifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save Apify Credentials
              </Button>
            ) : (
              <Button onClick={deleteApifyCredentials} disabled={isApifyLoading} variant="destructive">
                {isApifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Apify Credentials
              </Button>
            )}
          </div>

          {hasApifyCredentials && (
            <div className="rounded-md bg-green-50 p-3">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Apify credentials configured</span>
              </div>
              <p className="mt-1 text-sm text-green-700">
                Your Apify integration is ready for data scraping and monitoring operations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* X API Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Twitter className="h-5 w-5" />
            X API Integration (Posting)
          </CardTitle>
          <CardDescription>
            Configure your X API credentials for posting content and managing your X account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {xApiMessage && (
            <Alert className={xApiMessage.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={xApiMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {xApiMessage.text}
              </AlertDescription>
            </Alert>
          )}

          {xApiTestResult && (
            <Alert className={xApiTestResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={xApiTestResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="flex items-center gap-2">
                  {xApiTestResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span className="font-medium">Connection Test Result:</span>
                </div>
                <p className="mt-1">{xApiTestResult.message}</p>
                {xApiTestResult.success && xApiTestResult.user && (
                  <div className="mt-1 text-sm">
                    Connected as: <Badge variant="secondary">@{xApiTestResult.user.username}</Badge>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="x-api-key">API Key</Label>
              <Input
                id="x-api-key"
                type="password"
                placeholder="Enter your X API key"
                value={xApiKey}
                onChange={(e) => setXApiKey(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="x-api-key-secret">API Key Secret</Label>
              <Input
                id="x-api-key-secret"
                type="password"
                placeholder="Enter your X API key secret"
                value={xApiKeySecret}
                onChange={(e) => setXApiKeySecret(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="x-access-token">Access Token</Label>
              <Input
                id="x-access-token"
                type="password"
                placeholder="Enter your X access token"
                value={xAccessToken}
                onChange={(e) => setXAccessToken(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="x-access-token-secret">Access Token Secret</Label>
              <Input
                id="x-access-token-secret"
                type="password"
                placeholder="Enter your X access token secret"
                value={xAccessTokenSecret}
                onChange={(e) => setXAccessTokenSecret(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={testXApiConnection}
              disabled={isXApiLoading || !xApiKey.trim() || !xApiKeySecret.trim() || !xAccessToken.trim() || !xAccessTokenSecret.trim()}
              variant="outline"
            >
              {isXApiTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test X API Connection
            </Button>
          </div>

          <div className="flex gap-2">
            {!hasXApiCredentials ? (
              <Button onClick={saveXApiCredentials} disabled={isXApiLoading || !xApiKey.trim() || !xApiKeySecret.trim() || !xAccessToken.trim() || !xAccessTokenSecret.trim()}>
                {isXApiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Save X API Credentials
              </Button>
            ) : (
              <Button onClick={deleteXApiCredentials} disabled={isXApiLoading} variant="destructive">
                {isXApiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete X API Credentials
              </Button>
            )}
          </div>

          {hasXApiCredentials && (
            <div className="rounded-md bg-green-50 p-3">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">X API credentials configured</span>
              </div>
              <p className="mt-1 text-sm text-green-700">
                Your X API integration is ready for posting content and managing your account.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Status */}
      {(hasApifyCredentials || hasXApiCredentials) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span>Apify (Data Scraping):</span>
                <Badge variant={hasApifyCredentials ? 'default' : 'secondary'}>
                  {hasApifyCredentials ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                <span>X API (Posting):</span>
                <Badge variant={hasXApiCredentials ? 'default' : 'secondary'}>
                  {hasXApiCredentials ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
            </div>
            {hasApifyCredentials && hasXApiCredentials && (
              <div className="mt-4 rounded-md bg-blue-50 p-3">
                <p className="text-sm text-blue-800">
                  🎉 Your hybrid integration is fully configured! You can now scrape data with Apify and post content with the X API.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
