'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, Trash2, TestTube, Bot } from 'lucide-react';
import { XApiSetupWizard } from '@/components/x-api-setup-wizard';

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

  const checkExistingCredentials = useCallback(async () => {
    try {
      // Check Apify credentials
      const apifyResponse = await fetch('/api/settings/apify-credentials');
      if (apifyResponse.ok) {
        const apifyData = await apifyResponse.json();
        setHasApifyCredentials(apifyData.hasCredentials);
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
  }, [userId]);

  useEffect(() => {
    console.log('🔧 HybridSettings - useEffect triggered, checking credentials for userId:', userId);
    checkExistingCredentials();
  }, [checkExistingCredentials, userId]);

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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      setApifyMessage({ type: 'error', text: 'Failed to save username. Please try again.' });
    } finally {
      setIsXUsernameLoading(false);
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

      <XApiSetupWizard mode="settings" userId={userId} />

      {/* Integration Status */}
      {hasApifyCredentials && (
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
