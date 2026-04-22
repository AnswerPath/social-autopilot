'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, TestTube, ExternalLink, Twitter } from 'lucide-react'

interface StepConnectXProps {
  onSkip: () => void
  onContinue: () => void
  loading: boolean
}

export function StepConnectX({ onSkip, onContinue, loading }: StepConnectXProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const [apifyApiKey, setApifyApiKey] = useState('')
  const [xApiKey, setXApiKey] = useState('')
  const [xApiKeySecret, setXApiKeySecret] = useState('')
  const [xBearerToken, setXBearerToken] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [hasXConsumerKeys, setHasXConsumerKeys] = useState(false)

  const refreshXStatus = useCallback(async () => {
    const r = await fetch('/api/settings/x-api-credentials')
    if (!r.ok) return
    const d = await r.json()
    setHasXConsumerKeys(!!d.hasConsumerKeys)
  }, [])

  useEffect(() => {
    void refreshXStatus()
  }, [refreshXStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = new URL(window.location.href)
    if (u.searchParams.get('x_connected') === '1') {
      setMessage({ type: 'success', text: 'X account connected. You can continue onboarding.' })
      void refreshXStatus()
      window.history.replaceState({}, '', u.pathname)
    }
    const err = u.searchParams.get('x_error')
    if (err) {
      setMessage({
        type: 'error',
        text:
          err === 'denied'
            ? 'Authorization was cancelled on X.'
            : `Could not complete X connection (${decodeURIComponent(err)}).`,
      })
      window.history.replaceState({}, '', u.pathname)
    }
  }, [refreshXStatus])

  const saveAndTest = async () => {
    setMessage(null)
    const hasApify = apifyApiKey.trim().length > 0
    const hasXConsumer = xApiKey.trim().length > 0 && xApiKeySecret.trim().length > 0

    if (!hasApify && !hasXConsumer) {
      setMessage({ type: 'error', text: 'Enter at least Apify API key or X API consumer key + secret.' })
      return
    }

    if ((hasApify || hasXConsumer) && !userId) {
      setMessage({ type: 'error', text: 'Session expired. Please log in again to save credentials.' })
      return
    }

    setIsSaving(true)
    try {
      if (hasApify) {
        const r = await fetch('/api/settings/apify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apifyApiKey.trim() }),
        })
        if (!r.ok) {
          const d = await r.json()
          setMessage({ type: 'error', text: d.error || 'Failed to save Apify credentials' })
          setIsSaving(false)
          return
        }
      }
      if (hasXConsumer) {
        const body: Record<string, string> = {
          apiKey: xApiKey.trim(),
          apiKeySecret: xApiKeySecret.trim(),
        }
        if (xBearerToken.trim()) body.bearerToken = xBearerToken.trim()
        const r = await fetch('/api/settings/x-api-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!r.ok) {
          const d = await r.json()
          setMessage({ type: 'error', text: d.error || 'Failed to save X API credentials' })
          setIsSaving(false)
          return
        }
        await refreshXStatus()
      }

      setIsTesting(true)
      const credRes = await fetch('/api/settings/x-api-credentials')
      const credJson = credRes.ok ? await credRes.json() : {}

      if (hasApify) {
        const testRes = await fetch('/api/settings/test-apify-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apifyApiKey.trim() }),
        })
        const testData = await testRes.json()
        setMessage(
          testRes.ok
            ? { type: 'success', text: testData.message || 'Apify connection successful!' }
            : { type: 'error', text: testData.error || 'Apify connection test failed' }
        )
      }

      if (hasXConsumer && credJson.hasAccessTokens && userId) {
        const testRes = await fetch(`/api/settings/test-x-api-connection-saved?userId=${encodeURIComponent(userId)}`, {
          method: 'POST',
        })
        const testData = await testRes.json()
        setMessage(
          testRes.ok
            ? { type: 'success', text: testData.message || 'X connection successful!' }
            : { type: 'error', text: testData.error || 'X connection test failed' }
        )
      } else if (hasXConsumer && !credJson.hasAccessTokens) {
        setMessage({
          type: 'success',
          text: 'X consumer keys saved. Use “Connect with X”, then “Save & test” again.',
        })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setIsSaving(false)
      setIsTesting(false)
    }
  }

  const connectReturnTo =
    typeof window !== 'undefined'
      ? encodeURIComponent(window.location.pathname || '/onboarding')
      : encodeURIComponent('/onboarding')

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Connecting X lets you post, see mentions, and view analytics. Add an{' '}
        <a
          href="https://console.apify.com/account/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Apify API key
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        for scraping, and your{' '}
        <a
          href="https://developer.twitter.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          X developer app
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        consumer key + secret. Use <strong>Connect with X</strong> for OAuth 1.0a (no manual access tokens). You can also finish this in Settings → Integrations.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="onboarding-apify">Apify API Key (optional for posting)</Label>
          <Input
            id="onboarding-apify"
            type="password"
            placeholder="Enter Apify API key"
            value={apifyApiKey}
            onChange={(e) => setApifyApiKey(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-x-key">X API Key (consumer)</Label>
          <Input
            id="onboarding-x-key"
            type="password"
            placeholder="X API Key"
            value={xApiKey}
            onChange={(e) => setXApiKey(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-x-secret">X API Key Secret (consumer)</Label>
          <Input
            id="onboarding-x-secret"
            type="password"
            placeholder="X API Key Secret"
            value={xApiKeySecret}
            onChange={(e) => setXApiKeySecret(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-x-bearer">Bearer token (optional)</Label>
          <Input
            id="onboarding-x-bearer"
            type="password"
            placeholder="App-only Bearer token"
            value={xBearerToken}
            onChange={(e) => setXBearerToken(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="default"
          disabled={isSaving || !hasXConsumerKeys}
          onClick={() => {
            window.location.href = `/api/auth/twitter?returnTo=${connectReturnTo}`
          }}
        >
          <Twitter className="h-4 w-4 mr-2" />
          Connect with X
        </Button>
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

      <div className="flex flex-col-reverse sm:flex-row gap-2">
        <Button variant="outline" className="flex-1" onClick={onSkip} disabled={loading}>
          Skip for now
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={saveAndTest}
          disabled={isSaving || isTesting}
        >
          {isSaving || isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4" />
          )}
          Save &amp; test
        </Button>
        <Button className="flex-1" onClick={onContinue} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
