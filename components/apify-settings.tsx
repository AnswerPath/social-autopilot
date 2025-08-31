'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Key, Trash2, TestTube } from 'lucide-react';

interface ApifySettingsProps {
  userId: string;
}

export function ApifySettings({ userId }: ApifySettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; actorCount?: number } | null>(null);

  useEffect(() => {
    checkExistingCredentials();
  }, [userId]);

  const checkExistingCredentials = async () => {
    try {
      const response = await fetch(`/api/settings/apify-credentials?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setHasCredentials(data.hasCredentials);
      }
    } catch (error) {
      console.error('Error checking existing credentials:', error);
    }
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key to test' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/test-apify-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: data.message,
          actorCount: data.actorCount,
        });
        setMessage({ type: 'success', text: 'Connection test successful!' });
      } else {
        setTestResult({
          success: false,
          message: data.error,
        });
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Network error occurred',
      });
      setMessage({ type: 'error', text: 'Network error occurred while testing connection' });
    } finally {
      setIsTesting(false);
    }
  };

  const saveCredentials = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/apify-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Apify credentials saved successfully!' });
        setHasCredentials(true);
        setApiKey(''); // Clear the input for security
        setTestResult(null);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save credentials. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCredentials = async () => {
    if (!confirm('Are you sure you want to delete your Apify credentials? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/settings/apify-credentials?userId=${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Apify credentials deleted successfully!' });
        setHasCredentials(false);
        setTestResult(null);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete credentials. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateCredentials = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter a new API key' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/apify-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, apiKey: apiKey.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Apify credentials updated successfully!' });
        setApiKey(''); // Clear the input for security
        setTestResult(null);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update credentials. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Apify Integration
        </CardTitle>
        <CardDescription>
          Configure your Apify API key to enable automated social media operations using Apify actors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="font-medium">Connection Test Result:</span>
              </div>
              <p className="mt-1">{testResult.message}</p>
              {testResult.success && testResult.actorCount !== undefined && (
                <p className="mt-1 text-sm">
                  Available actors: <Badge variant="secondary">{testResult.actorCount}</Badge>
                </p>
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
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
            />
            <Button
              onClick={testConnection}
              disabled={isLoading || !apiKey.trim()}
              variant="outline"
              size="sm"
            >
              {isTesting ? (
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
          {!hasCredentials ? (
            <Button onClick={saveCredentials} disabled={isLoading || !apiKey.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Save Credentials
            </Button>
          ) : (
            <>
              <Button onClick={updateCredentials} disabled={isLoading || !apiKey.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Update Credentials
              </Button>
              <Button onClick={deleteCredentials} disabled={isLoading} variant="destructive">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </>
          )}
        </div>

        {hasCredentials && (
          <div className="rounded-md bg-green-50 p-3">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Apify credentials configured</span>
            </div>
            <p className="mt-1 text-sm text-green-700">
              Your Apify integration is ready to use. You can now schedule posts, retrieve mentions, and get analytics data.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
