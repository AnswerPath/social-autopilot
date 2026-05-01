'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Copy, ExternalLink, Key, Loader2, TestTube, Twitter, XCircle } from 'lucide-react'

interface XApiSetupWizardProps {
  mode?: 'settings' | 'onboarding'
  userId: string
  loading?: boolean
  onSkip?: () => void
  onContinue?: () => void
}

interface XCredentialStatus {
  hasCredentials: boolean
  hasConsumerKeys: boolean
  hasAccessTokens: boolean
  needsOAuth: boolean
  connectedXUsername?: string | null
}

type Message = { type: 'success' | 'error'; text: string } | null

const emptyStatus: XCredentialStatus = {
  hasCredentials: false,
  hasConsumerKeys: false,
  hasAccessTokens: false,
  needsOAuth: false,
  connectedXUsername: null,
}

export function XApiSetupWizard({
  mode = 'settings',
  userId,
  loading = false,
  onSkip,
  onContinue,
}: XApiSetupWizardProps) {
  const [xApiKey, setXApiKey] = useState('')
  const [xApiKeySecret, setXApiKeySecret] = useState('')
  const [xBearerToken, setXBearerToken] = useState('')
  const [status, setStatus] = useState<XCredentialStatus>(emptyStatus)
  const [message, setMessage] = useState<Message>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; user?: { username?: string } } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [oauthConfig, setOauthConfig] = useState<{ appOrigin: string; callbackUrl: string } | null>(null)

  const returnTo = mode === 'onboarding' ? '/onboarding' : '/account-settings'

  const appOrigin = oauthConfig?.appOrigin ?? 'your public app origin'
  const callbackUrl = oauthConfig?.callbackUrl

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/settings/x-api-credentials')
    if (!response.ok) return null
    const data = await response.json()
    const nextStatus = {
      hasCredentials: !!data.hasCredentials,
      hasConsumerKeys: !!data.hasConsumerKeys,
      hasAccessTokens: !!data.hasAccessTokens,
      needsOAuth: !!data.needsOAuth,
      connectedXUsername:
        typeof data.connectedXUsername === 'string' ? data.connectedXUsername : null,
    }
    setStatus(nextStatus)
    return nextStatus
  }, [])

  useEffect(() => {
    fetch('/api/auth/twitter/callback-url')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.callbackUrl === 'string' && typeof data.appOrigin === 'string') {
          setOauthConfig({
            appOrigin: data.appOrigin,
            callbackUrl: data.callbackUrl,
          })
        }
      })
      .catch((error) => {
        console.error('Failed to load X OAuth callback URL:', error)
        setMessage({
          type: 'error',
          text: 'Could not load the server-resolved X callback URL. Refresh before copying it into X.',
        })
      })

    void refreshStatus().catch((error) => {
      console.error('Failed to load X API credential status:', error)
    })
  }, [refreshStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const connected = url.searchParams.get('x_connected')
    const error = url.searchParams.get('x_error')

    if (connected === '1') {
      setMessage({ type: 'success', text: 'X account authorized. Access tokens saved securely.' })
      void refreshStatus()
    } else if (error) {
      const text =
        error === 'denied'
          ? 'Authorization was cancelled on X.'
          : error === 'missing_oauth_params'
            ? 'OAuth session expired. Try Connect with X again.'
            : error === 'oauth_token_mismatch'
              ? 'OAuth security check failed. Try Connect with X again.'
              : error === 'no_consumer_keys'
                ? 'Save your API Key and Secret before connecting.'
                : `X connection failed: ${error}`
      setMessage({ type: 'error', text })
      void refreshStatus()
    }

    if (connected === '1' || error) {
      url.searchParams.delete('x_connected')
      url.searchParams.delete('x_error')
      const nextUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [refreshStatus])

  const copyCallbackUrl = async () => {
    if (!callbackUrl) return
    if (!navigator.clipboard) return
    await navigator.clipboard.writeText(callbackUrl)
    setMessage({ type: 'success', text: 'Callback URL copied.' })
  }

  const saveConsumerKeys = async () => {
    if (!xApiKey.trim() || !xApiKeySecret.trim()) {
      setMessage({ type: 'error', text: 'Enter your X API Key and API Key Secret.' })
      return
    }

    setIsSaving(true)
    setMessage(null)
    setTestResult(null)

    try {
      const body: Record<string, string> = {
        apiKey: xApiKey.trim(),
        apiKeySecret: xApiKeySecret.trim(),
      }
      if (xBearerToken.trim()) body.bearerToken = xBearerToken.trim()

      const response = await fetch('/api/settings/x-api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to save X API credentials.' })
        return
      }

      setMessage({
        type: 'success',
        text:
          data.needsOAuth === true
            ? 'Consumer keys saved. Use Connect with X to authorize posting access.'
            : data.message || 'X API credentials saved.',
      })
      setXApiKey('')
      setXApiKeySecret('')
      setXBearerToken('')
      await refreshStatus()
    } catch {
      setMessage({ type: 'error', text: 'Network error while saving credentials. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    if (!status.hasAccessTokens) {
      setMessage({
        type: 'error',
        text: 'Save consumer keys and complete Connect with X before testing.',
      })
      return
    }

    setIsTesting(true)
    setMessage(null)
    setTestResult(null)

    try {
      const response = await fetch(
        `/api/settings/test-x-api-connection-saved?userId=${encodeURIComponent(userId)}`,
        { method: 'POST' }
      )
      const data = await response.json()
      const result = {
        success: response.ok,
        message: response.ok
          ? data.message || 'X connection successful.'
          : data.error || 'X connection test failed.',
        user: data.user,
      }
      setTestResult(result)
      setMessage({ type: result.success ? 'success' : 'error', text: result.message })
    } catch {
      setTestResult({ success: false, message: 'Network error while testing connection.' })
      setMessage({ type: 'error', text: 'Network error while testing connection.' })
    } finally {
      setIsTesting(false)
    }
  }

  const disconnectAccess = async () => {
    if (!confirm('Remove X access tokens? You can reconnect without re-entering consumer keys.')) return

    setIsDeleting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/x-api-credentials?scope=access', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect X account.' })
        return
      }
      setMessage({ type: 'success', text: data.message || 'Disconnected from X.' })
      setTestResult(null)
      await refreshStatus()
    } catch {
      setMessage({ type: 'error', text: 'Network error while disconnecting X.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const removeAllCredentials = async () => {
    if (!confirm('Are you sure you want to delete your X API credentials? This action cannot be undone.')) return

    setIsDeleting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/settings/x-api-credentials', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to remove X API credentials.' })
        return
      }
      setMessage({ type: 'success', text: data.message || 'X API credentials removed.' })
      setStatus(emptyStatus)
      setTestResult(null)
    } catch {
      setMessage({ type: 'error', text: 'Network error while removing credentials.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const connectWithX = () => {
    window.location.href = `/api/auth/twitter?returnTo=${encodeURIComponent(returnTo)}`
  }

  const busy = loading || isSaving || isTesting || isDeleting

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          X API setup wizard
        </CardTitle>
        <CardDescription>
          Follow these steps to create your X developer app, save consumer keys, authorize OAuth, and verify posting access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Badge variant="secondary">1</Badge>
              Create an X developer app
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the{' '}
              <a
                href="https://developer.twitter.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                X developer portal
                <ExternalLink className="h-3 w-3" />
              </a>
              , create or select a project app, and open its Keys and tokens page.
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Badge variant="secondary">2</Badge>
              Configure app permissions and callback
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Enable OAuth 1.0a user context with read and write permissions. Add this callback URL in the app settings:
            </p>
            <div className="mt-3 flex gap-2">
              <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">
                {callbackUrl ?? 'Loading server-resolved callback URL...'}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyCallbackUrl}
                disabled={!callbackUrl}
                aria-label="Copy callback URL"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 font-medium">
              <Badge variant="secondary">3</Badge>
              Match app URL variables
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              In deployment, set <code>NEXT_PUBLIC_APP_URL</code> or <code>NEXTAUTH_URL</code> to your public app origin, for example{' '}
              <code>{appOrigin}</code>. This must match the origin used in the X callback URL.
            </p>
          </div>
        </div>

        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border p-4">
          <div className="mb-4 flex items-center gap-2 font-medium">
            <Key className="h-4 w-4" />
            Save X API keys
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="x-api-key">API Key (consumer)</Label>
              <Input
                id="x-api-key"
                type="password"
                placeholder="Paste API Key from Keys and tokens"
                value={xApiKey}
                onChange={(event) => setXApiKey(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="x-api-key-secret">API Key Secret (consumer)</Label>
              <Input
                id="x-api-key-secret"
                type="password"
                placeholder="Paste API Key Secret"
                value={xApiKeySecret}
                onChange={(event) => setXApiKeySecret(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="x-bearer-token">Bearer token (optional)</Label>
              <Input
                id="x-bearer-token"
                type="password"
                placeholder="Optional app-only Bearer token for read-only checks"
                value={xBearerToken}
                onChange={(event) => setXBearerToken(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You only paste the consumer key pair here. Access tokens are created by Connect with X and stored encrypted after OAuth.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveConsumerKeys} disabled={busy || !xApiKey.trim() || !xApiKeySecret.trim()}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Save consumer keys
          </Button>
          <Button type="button" onClick={connectWithX} disabled={busy || !status.hasConsumerKeys}>
            <Twitter className="h-4 w-4" />
            Connect with X
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={busy || !status.hasAccessTokens}
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Test X API Connection
          </Button>
          {status.hasAccessTokens && (
            <Button type="button" variant="outline" onClick={disconnectAccess} disabled={busy}>
              Disconnect X account
            </Button>
          )}
          {mode === 'settings' && status.hasCredentials && (
            <Button type="button" variant="destructive" onClick={removeAllCredentials} disabled={busy}>
              Remove all X API data
            </Button>
          )}
        </div>

        {testResult && (
          <Alert className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={testResult.success ? 'text-green-800' : 'text-red-800'}>
              <div className="flex items-center gap-2">
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span>{testResult.message}</span>
              </div>
              {testResult.success && testResult.user?.username && (
                <p className="mt-1 text-sm">
                  Connected as <Badge variant="secondary">@{testResult.user.username}</Badge>
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {status.hasConsumerKeys && !status.hasAccessTokens && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-amber-900">
              <Twitter className="h-4 w-4" />
              <span className="text-sm font-medium">OAuth pending</span>
            </div>
            <p className="mt-1 text-sm text-amber-800">
              Consumer keys are saved. Use <strong>Connect with X</strong> to authorize posting for your account.
            </p>
          </div>
        )}

        {status.hasAccessTokens && (
          <div className="rounded-md bg-green-50 p-3">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">X API ready for posting</span>
            </div>
            <p className="mt-1 text-sm text-green-700">
              {status.connectedXUsername ? (
                <>
                  Connected as <Badge variant="secondary">@{status.connectedXUsername}</Badge>
                </>
              ) : (
                <>Access tokens are stored. You can post and use timeline features.</>
              )}
            </p>
          </div>
        )}

        {mode === 'onboarding' && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {onSkip && (
              <Button type="button" variant="outline" className="flex-1" onClick={onSkip} disabled={loading}>
                Skip for now
              </Button>
            )}
            {onContinue && (
              <Button type="button" className="flex-1" onClick={onContinue} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
