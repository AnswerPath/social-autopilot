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
  // Log the userId we receive
  console.log('🔧 HybridSettings - Received userId:', userId);
  console.log('   userId type:', typeof userId);
  console.log('   userId value:', userId);
  
  // Apify state
  const [apifyApiKey, setApifyApiKey] = useState('');
  const [hasApifyCredentials, setHasApifyCredentials] = useState(false);
  const [apifyMessage, setApifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isApifyTesting, setIsApifyTesting] = useState(false);
  const [apifyTestResult, setApifyTestResult] = useState<{ success: boolean; message: string; actorCount?: number } | null>(null);
  const [isApifyLoading, setIsApifyLoading] = useState(false);
  
  // X Username state (to avoid rate limit issues)
  const [xUsername, setXUsername] = useState('');
  const [hasXUsername, setHasXUsername] = useState(false);
  const [isXUsernameLoading, setIsXUsernameLoading] = useState(false);

  // X API state (consumer keys + optional bearer; access tokens via OAuth 1.0a redirect)
  const [xApiKey, setXApiKey] = useState('');
  const [xApiKeySecret, setXApiKeySecret] = useState('');
  const [xBearerToken, setXBearerToken] = useState('');
  const [hasXApiCredentials, setHasXApiCredentials] = useState(false);
  const [hasXConsumerKeys, setHasXConsumerKeys] = useState(false);
  const [hasXAccessTokens, setHasXAccessTokens] = useState(false);
  const [connectedXHandle, setConnectedXHandle] = useState<string | null>(null);
  const [xApiMessage, setXApiMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isXApiTesting, setIsXApiTesting] = useState(false);
  const [xApiTestResult, setXApiTestResult] = useState<{ success: boolean; message: string; user?: any } | null>(null);
  const [isXApiLoading, setIsXApiLoading] = useState(false);

  useEffect(() => {
    console.log('🔧 HybridSettings - useEffect triggered, checking credentials for userId:', userId);
    checkExistingCredentials();
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    const connected = u.searchParams.get('x_connected');
    const err = u.searchParams.get('x_error');
    if (connected === '1') {
      setXApiMessage({ type: 'success', text: 'X account authorized. Access tokens saved securely.' });
      void checkExistingCredentials();
    } else if (err) {
      const human =
        err === 'denied'
          ? 'Authorization was cancelled on X.'
          : err === 'missing_oauth_params'
            ? 'OAuth session expired. Try Connect with X again.'
            : err === 'oauth_token_mismatch'
              ? 'OAuth security check failed. Try Connect with X again.'
              : err === 'no_consumer_keys'
                ? 'Save your API Key and Secret before connecting.'
                : `X connection failed: ${err}`;
      setXApiMessage({ type: 'error', text: human });
      void checkExistingCredentials();
    }
    if (connected === '1' || err) {
      const params = new URLSearchParams(u.searchParams);
      params.delete('x_connected');
      params.delete('x_error');
      const newUrl = `${u.pathname}${params.toString() ? `?${params.toString()}` : ''}${u.hash}`;
      window.history.replaceState({}, '', newUrl);
    }
    // Intentionally once on mount for OAuth redirect query params
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh credential banner after redirect
  }, []);

  const checkExistingCredentials = async () => {
    try {
      // Check Apify credentials
      const apifyResponse = await fetch('/api/settings/apify-credentials');
      if (apifyResponse.ok) {
        const apifyData = await apifyResponse.json();
        setHasApifyCredentials(apifyData.hasCredentials);
      }

      const xApiResponse = await fetch('/api/settings/x-api-credentials');
      if (xApiResponse.ok) {
        const xApiData = await xApiResponse.json();
        setHasXApiCredentials(!!xApiData.hasCredentials);
        setHasXConsumerKeys(!!xApiData.hasConsumerKeys);
        setHasXAccessTokens(!!xApiData.hasAccessTokens);
        setConnectedXHandle(
          typeof xApiData.connectedXUsername === 'string' ? xApiData.connectedXUsername : null
        );
      }
      
      // Check stored X username
      const usernameResponse = await fetch(`/api/settings/x-username?userId=${userId}`);
      if (usernameResponse.ok) {
        const usernameData = await usernameResponse.json();
        if (usernameData.success && usernameData.username) {
          setXUsername(usernameData.username);
          setHasXUsername(true);
        }
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

    console.log('💾 Saving Apify credentials for userId:', userId);
    console.log('   userId type:', typeof userId);
    console.log('   userId value:', userId);
    
    if (!userId || userId === 'demo-user') {
      console.error('❌ Cannot save credentials: Invalid userId:', userId);
      setApifyMessage({ type: 'error', text: 'Authentication error: Please log in and try again.' });
      return;
    }

    setIsApifyLoading(true);
    setApifyMessage(null);

    try {
      const response = await fetch('/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apifyApiKey.trim() }),
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
      const response = await fetch('/api/settings/apify-credentials', {
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

  // X Username functions
  const saveXUsername = async () => {
    if (!xUsername.trim()) {
      setApifyMessage({ type: 'error', text: 'Please enter your X username' });
      return;
    }

    setIsXUsernameLoading(true);
    setApifyMessage(null);

    try {
      const response = await fetch('/api/settings/x-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, username: xUsername.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setApifyMessage({ type: 'success', text: 'X username saved successfully! This will help avoid rate limit issues.' });
        setHasXUsername(true);
        setXUsername(''); // Clear the input
      } else {
        setApifyMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setApifyMessage({ type: 'error', text: 'Failed to save username. Please try again.' });
    } finally {
      setIsXUsernameLoading(false);
    }
  };

  // X API functions
  const testXApiConnection = async () => {
    setIsXApiTesting(true);
    setXApiTestResult(null);
    setXApiMessage(null);

    try {
      if (!hasXAccessTokens) {
        setXApiMessage({
          type: 'error',
          text: 'Save your API Key and Secret, then use Connect with X to authorize before testing.',
        });
        setIsXApiTesting(false);
        return;
      }

      const response = await fetch(`/api/settings/test-x-api-connection-saved?userId=${userId}`, {
        method: 'POST',
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
    if (!xApiKey.trim() || !xApiKeySecret.trim()) {
      setXApiMessage({ type: 'error', text: 'Please enter your X API Key and API Key Secret' });
      return;
    }

    setIsXApiLoading(true);
    setXApiMessage(null);

    try {
      const body: Record<string, string> = {
        apiKey: xApiKey.trim(),
        apiKeySecret: xApiKeySecret.trim(),
      };
      if (xBearerToken.trim()) {
        body.bearerToken = xBearerToken.trim();
      }

      const response = await fetch('/api/settings/x-api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setXApiMessage({
          type: 'success',
          text:
            data.needsOAuth === true
              ? 'Consumer keys saved. Click “Connect with X” to authorize and obtain access tokens.'
              : 'X API credentials saved successfully!',
        });
        void checkExistingCredentials().catch(error => {
          console.error('Failed to refresh X API credential status after save:', error);
        });
        setXApiKey('');
        setXApiKeySecret('');
        setXBearerToken('');
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

  const disconnectXAccessOnly = async () => {
    if (!confirm('Remove X access tokens? You can reconnect with “Connect with X” without re-entering consumer keys.')) {
      return;
    }
    setIsXApiLoading(true);
    setXApiMessage(null);
    try {
      const response = await fetch('/api/settings/x-api-credentials?scope=access', { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        setXApiMessage({ type: 'success', text: data.message || 'Disconnected from X.' });
        void checkExistingCredentials().catch(error => {
          console.error('Failed to refresh X API credential status after disconnect:', error);
        });
        setXApiTestResult(null);
      } else {
        setXApiMessage({ type: 'error', text: data.error || 'Failed to disconnect' });
      }
    } catch (err) {
      console.error('Failed to disconnect', err);
      setXApiMessage({ type: 'error', text: 'Failed to disconnect. Please try again.' });
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
      const response = await fetch('/api/settings/x-api-credentials', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setXApiMessage({ type: 'success', text: 'X API credentials deleted successfully!' });
        setHasXApiCredentials(false);
        setHasXConsumerKeys(false);
        setHasXAccessTokens(false);
        setConnectedXHandle(null);
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

          {/* X Username Input */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <Label htmlFor="x-username">X Username (Optional - to avoid rate limits)</Label>
            <div className="flex gap-2">
              <Input
                id="x-username"
                type="text"
                placeholder="Enter your X username (e.g., yourusername)"
                value={xUsername}
                onChange={(e) => setXUsername(e.target.value.replace(/^@/, ''))}
                disabled={isXUsernameLoading}
              />
              <Button
                onClick={saveXUsername}
                disabled={isXUsernameLoading || !xUsername.trim()}
                variant="outline"
                size="sm"
              >
                {isXUsernameLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Save
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter your X username here to avoid rate limit issues. The app will use this instead of fetching it from X API.
              {hasXUsername && (
                <span className="ml-2 text-green-600 font-medium">✓ Username saved</span>
              )}
            </p>
          </div>
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
            Enter your app&apos;s <strong>API Key</strong> and <strong>API Key Secret</strong> from the{' '}
            <a href="https://developer.twitter.com/" target="_blank" rel="noopener noreferrer" className="underline">
              X developer portal
            </a>
            . Set the callback URL to <code className="text-xs bg-muted px-1 rounded">…/api/auth/twitter/callback</code>{' '}
            (same origin as this app). Then use <strong>Connect with X</strong> to complete OAuth 1.0a — access tokens are
            stored encrypted; you do not paste them manually. Optional <strong>Bearer token</strong> helps some read-only checks.
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
              <Label htmlFor="x-api-key">API Key (consumer)</Label>
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
              <Label htmlFor="x-api-key-secret">API Key Secret (consumer)</Label>
              <Input
                id="x-api-key-secret"
                type="password"
                placeholder="Enter your X API key secret"
                value={xApiKeySecret}
                onChange={(e) => setXApiKeySecret(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="x-bearer-token">Bearer token (optional)</Label>
              <Input
                id="x-bearer-token"
                type="password"
                placeholder="App-only Bearer token from the developer portal, if you use it"
                value={xBearerToken}
                onChange={(e) => setXBearerToken(e.target.value)}
                disabled={isXApiLoading}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={testXApiConnection}
              disabled={isXApiLoading || isXApiTesting || !hasXAccessTokens}
              variant="outline"
            >
              {isXApiTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test X API Connection
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={isXApiLoading || !hasXConsumerKeys}
              onClick={() => {
                window.location.href = '/api/auth/twitter?returnTo=/account-settings';
              }}
            >
              <Twitter className="h-4 w-4 mr-2 inline" />
              Connect with X
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Save your consumer keys first, then use Connect with X (requires a saved row in the database).
          </p>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveXApiCredentials} disabled={isXApiLoading || !xApiKey.trim() || !xApiKeySecret.trim()}>
              {isXApiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save consumer keys
            </Button>
            {hasXAccessTokens && (
              <Button onClick={disconnectXAccessOnly} disabled={isXApiLoading} variant="outline">
                Disconnect X account
              </Button>
            )}
            {hasXApiCredentials && (
              <Button onClick={deleteXApiCredentials} disabled={isXApiLoading} variant="destructive">
                {isXApiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove all X API data
              </Button>
            )}
          </div>

          {hasXConsumerKeys && !hasXAccessTokens && (
            <div className="rounded-md bg-amber-50 p-3 border border-amber-200">
              <div className="flex items-center gap-2 text-amber-900">
                <Twitter className="h-4 w-4" />
                <span className="text-sm font-medium">OAuth pending</span>
              </div>
              <p className="mt-1 text-sm text-amber-800">
                Consumer keys are saved. Use <strong>Connect with X</strong> to authorize posting for your account.
              </p>
            </div>
          )}

          {hasXAccessTokens && (
            <div className="rounded-md bg-green-50 p-3">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">X API ready for posting</span>
              </div>
              <p className="mt-1 text-sm text-green-700">
                {connectedXHandle ? (
                  <>
                    Connected as <Badge variant="secondary">@{connectedXHandle}</Badge>
                  </>
                ) : (
                  <>Access tokens stored. You can post and use timeline features.</>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Status */}
      {(hasApifyCredentials || hasXConsumerKeys || hasXAccessTokens) && (
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
                <Badge variant={hasXAccessTokens ? 'default' : 'secondary'}>
                  {hasXAccessTokens ? 'Connected' : hasXConsumerKeys ? 'OAuth pending' : 'Not configured'}
                </Badge>
              </div>
            </div>
            {hasApifyCredentials && hasXAccessTokens && (
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
