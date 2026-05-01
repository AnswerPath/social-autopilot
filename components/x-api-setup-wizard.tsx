'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Key,
  Loader2,
  TestTube,
  Twitter,
  XCircle,
} from 'lucide-react'

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

type WizardStep = 'welcome' | 'app_settings' | 'connect' | 'connected'

const emptyStatus: XCredentialStatus = {
  hasCredentials: false,
  hasConsumerKeys: false,
  hasAccessTokens: false,
  needsOAuth: false,
  connectedXUsername: null,
}

const STEP_ORDER: WizardStep[] = ['welcome', 'app_settings', 'connect', 'connected']

function stepIndex(step: WizardStep): number {
  return STEP_ORDER.indexOf(step)
}

function progressValue(step: WizardStep): number {
  const i = stepIndex(step)
  if (i < 0) return 0
  return Math.round(((i + 1) / STEP_ORDER.length) * 100)
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
  const [status, setStatus] = useState<XCredentialStatus>(emptyStatus)
  const [wizardStep, setWizardStep] = useState<WizardStep>('welcome')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    user?: { username?: string }
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [oauthConfig, setOauthConfig] = useState<{ appOrigin: string; callbackUrl: string } | null>(null)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [removeAllDialogOpen, setRemoveAllDialogOpen] = useState(false)

  const returnTo = mode === 'onboarding' ? '/onboarding' : '/account-settings'
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
          text: 'Could not load the server-resolved X callback URL. Refresh and try again.',
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
      void refreshStatus().then(() => setWizardStep('connected'))
    } else if (error) {
      const text =
        error === 'denied'
          ? 'Authorization was cancelled on X.'
          : error === 'missing_oauth_params'
            ? 'OAuth session expired. Try Connect with X again.'
            : error === 'oauth_token_mismatch'
              ? 'OAuth security check failed. Try Connect with X again.'
              : error === 'no_consumer_keys'
                ? 'This app is not ready to connect yet. Ask your administrator to configure X in Account Settings, or open Advanced (settings) if you manage keys yourself.'
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

  useEffect(() => {
    if (status.hasAccessTokens) {
      setWizardStep('connected')
    }
  }, [status.hasAccessTokens])

  const goNext = () => {
    const i = stepIndex(wizardStep)
    if (wizardStep === 'connected' || i < 0 || i >= STEP_ORDER.length - 1) return
    setWizardStep(STEP_ORDER[i + 1] as WizardStep)
  }

  const goBack = () => {
    const i = stepIndex(wizardStep)
    if (i <= 0) return
    if (wizardStep === 'connected') return
    setWizardStep(STEP_ORDER[i - 1] as WizardStep)
  }

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
      await refreshStatus()
      setWizardStep('connect')
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
        text: 'Complete Connect with X before testing.',
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

  const runDisconnectAccess = async () => {
    setIsDeleting(true)
    setMessage(null)
    setDisconnectDialogOpen(false)

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
      setWizardStep('connect')
    } catch {
      setMessage({ type: 'error', text: 'Network error while disconnecting X.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const runRemoveAllCredentials = async () => {
    setIsDeleting(true)
    setMessage(null)
    setRemoveAllDialogOpen(false)

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
      setWizardStep('welcome')
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

  const stepBadge = (step: WizardStep, label: string) => (
    <div className="flex items-center gap-2 text-sm">
      <Badge variant={wizardStep === step ? 'default' : 'secondary'}>{stepIndex(step) + 1}</Badge>
      <span className={wizardStep === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Twitter className="h-5 w-5" />
          Connect to X
        </CardTitle>
        <CardDescription>
          Step-by-step: adjust your X app if needed, then authorize this app to post on your behalf.
        </CardDescription>
        {wizardStep !== 'connected' && (
          <div className="pt-2 space-y-2">
            <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
              {stepBadge('welcome', 'Overview')}
              {stepBadge('app_settings', 'X app')}
              {stepBadge('connect', 'Authorize')}
              {stepBadge('connected', 'Done')}
            </div>
            <Progress value={progressValue(wizardStep)} className="h-2" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
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

        {wizardStep === 'welcome' && (
          <div className="rounded-lg border p-6 space-y-4">
            <h3 className="font-semibold text-lg">Welcome</h3>
            <p className="text-sm text-muted-foreground">
              You will connect your personal X account so Social Autopilot can schedule and publish posts. If your
              organization manages an X developer app, you may only need to authorize in the next steps.
            </p>
            {status.hasAccessTokens ? (
              <p className="text-sm text-green-800 font-medium">You are already connected to X.</p>
            ) : status.hasConsumerKeys && !status.hasAccessTokens ? (
              <Alert className="border-amber-200 bg-amber-50">
                <Twitter className="h-4 w-4 text-amber-800" />
                <AlertDescription className="text-amber-900">
                  Authorization is still pending. Continue to <strong>Authorize</strong> and tap Connect with X.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" onClick={goNext}>
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 'app_settings' && (
          <div className="rounded-lg border p-6 space-y-5">
            <h3 className="font-semibold text-lg">Configure your X developer app</h3>
            <p className="text-sm text-muted-foreground">
              If you manage the X app (or were asked to), open the developer portal and ensure OAuth 1.0a is enabled
              with read and write. Add the callback URL below exactly as shown.
            </p>
            <div className="space-y-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://developer.twitter.com/" target="_blank" rel="noopener noreferrer">
                  Open X developer portal
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Callback URL (paste into your X app)</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded bg-muted px-2 py-2 text-xs break-all">
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
            <div className="flex flex-wrap gap-2 justify-between">
              <Button type="button" variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button type="button" onClick={goNext}>
                I&apos;ve updated my app — continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 'connect' && (
          <div className="rounded-lg border p-6 space-y-5">
            <h3 className="font-semibold text-lg">Authorize with X</h3>
            {!status.hasConsumerKeys && (
              <Alert>
                <AlertDescription className="text-sm">
                  {mode === 'onboarding' ? (
                    <>
                      This deployment does not have X consumer keys yet. Ask an administrator to add them in{' '}
                      <a href="/account-settings" className="underline font-medium text-primary">
                        Account Settings
                      </a>
                      , or skip and finish onboarding.
                    </>
                  ) : (
                    <>
                      Save consumer keys in <strong>Advanced: X consumer keys</strong> below, then return here to
                      connect.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {status.hasConsumerKeys && !status.hasAccessTokens && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-amber-900">
                  <Twitter className="h-4 w-4" />
                  <span className="text-sm font-medium">Ready to authorize</span>
                </div>
                <p className="mt-1 text-sm text-amber-800">
                  Click <strong>Connect with X</strong>. You will sign in on X and approve this app.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                className="min-w-[200px]"
                onClick={connectWithX}
                disabled={busy || !status.hasConsumerKeys}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Connect with X
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 justify-between">
              <Button type="button" variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              {status.hasAccessTokens && (
                <Button type="button" onClick={() => setWizardStep('connected')}>
                  View connection status
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {wizardStep === 'connected' && status.hasAccessTokens && (
          <div className="rounded-lg border p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <h3 className="font-semibold text-lg">You&apos;re connected</h3>
            </div>
            <p className="text-sm text-green-800">
              {status.connectedXUsername ? (
                <>
                  Connected as <Badge variant="secondary">@{status.connectedXUsername}</Badge>
                </>
              ) : (
                <>Access tokens are stored. You can post and use timeline features.</>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={testConnection} disabled={busy}>
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                Test X API Connection
              </Button>
              <Button type="button" variant="outline" onClick={() => setDisconnectDialogOpen(true)} disabled={busy}>
                Disconnect X account
              </Button>
              {mode === 'settings' && status.hasCredentials && (
                <Button type="button" variant="destructive" onClick={() => setRemoveAllDialogOpen(true)} disabled={busy}>
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
                      Verified as <Badge variant="secondary">@{testResult.user.username}</Badge>
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {mode === 'onboarding' && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row pt-2">
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
          </div>
        )}

        {mode === 'settings' && (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex w-full items-center justify-between p-4 h-auto">
                <span className="flex items-center gap-2 font-medium">
                  <Key className="h-4 w-4" />
                  Advanced: X consumer keys (developer setup)
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t p-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Paste the API Key and Secret from the X developer portal. Access tokens are created only after you use
                  Connect with X. Deployment and URL configuration is handled by whoever hosts this app—not here.
                </p>
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
                </div>
                <Button onClick={saveConsumerKeys} disabled={busy || !xApiKey.trim() || !xApiKeySecret.trim()}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Save consumer keys
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect X account?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes your X access tokens from this app. You can reconnect afterward without re-entering
                consumer keys if they stay saved.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault()
                  void runDisconnectAccess()
                }}
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={removeAllDialogOpen} onOpenChange={setRemoveAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove all X API data?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes stored consumer keys and access tokens for X. You cannot undo this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault()
                  void runRemoveAllCredentials()
                }}
              >
                Remove all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {mode === 'onboarding' && wizardStep !== 'connected' && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row border-t pt-4">
            {onSkip && (
              <Button type="button" variant="outline" className="flex-1" onClick={onSkip} disabled={loading}>
                Skip for now
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
