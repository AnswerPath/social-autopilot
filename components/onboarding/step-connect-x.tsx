'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, TestTube, ExternalLink } from 'lucide-react'

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
  const [xAccessToken, setXAccessToken] = useState('')
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null)

  const saveAndTest = async () => {
    setMessage(null)
    setTestSuccess(null)
    const hasApify = apifyApiKey.trim().length > 0
    const hasX = [xApiKey, xApiKeySecret, xAccessToken, xAccessTokenSecret].every((s) => s.trim().length > 0)

    if (!hasApify && !hasX) {
      setMessage({ type: 'error', text: 'Enter at least Apify API key or X API credentials.' })
      return
    }

    setIsSaving(true)
    try {
      if (hasApify && userId) {
        const r = await fetch('/api/settings/apify-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, apiKey: apifyApiKey.trim() }),
        })
        if (!r.ok) {
          const d = await r.json()
          setMessage({ type: 'error', text: d.error || 'Failed to save Apify credentials' })
          setIsSaving(false)
          return
        }
      }
      if (hasX && userId) {
        const r = await fetch('/api/settings/x-api-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            apiKey: xApiKey.trim(),
            apiKeySecret: xApiKeySecret.trim(),
            accessToken: xAccessToken.trim(),
            accessTokenSecret: xAccessTokenSecret.trim(),
          }),
        })
        if (!r.ok) {
          const d = await r.json()
          setMessage({ type: 'error', text: d.error || 'Failed to save X API credentials' })
          setIsSaving(false)
          return
        }
      }
      setMessage({ type: 'success', text: 'Credentials saved. Testing connection…' })
      setIsTesting(true)
      if (hasX) {
        const testRes = await fetch('/api/settings/test-x-api-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: xApiKey.trim(),
            apiKeySecret: xApiKeySecret.trim(),
            accessToken: xAccessToken.trim(),
            accessTokenSecret: xAccessTokenSecret.trim(),
          }),
        })
        const testData = await testRes.json()
        setTestSuccess(testRes.ok)
        setMessage(
          testRes.ok
            ? { type: 'success', text: testData.message || 'X connection successful!' }
            : { type: 'error', text: testData.error || 'X connection test failed' }
        )
      } else if (hasApify) {
        const testRes = await fetch('/api/settings/test-apify-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apifyApiKey.trim() }),
        })
        const testData = await testRes.json()
        setTestSuccess(testRes.ok)
        setMessage(
          testRes.ok
            ? { type: 'success', text: testData.message || 'Apify connection successful!' }
            : { type: 'error', text: testData.error || 'Apify connection test failed' }
        )
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' })
    } finally {
      setIsSaving(false)
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Connecting X lets you post, see mentions, and view analytics. You need an{' '}
        <a
          href="https://console.apify.com/account/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          Apify API key
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        and{' '}
        <a
          href="https://developer.twitter.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          X API credentials
          <ExternalLink className="h-3 w-3" />
        </a>
        . You can also do this later in Settings → Integrations.
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
          <Label htmlFor="onboarding-x-key">X API Key</Label>
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
          <Label htmlFor="onboarding-x-secret">X API Key Secret</Label>
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
          <Label htmlFor="onboarding-x-access">Access Token</Label>
          <Input
            id="onboarding-x-access"
            type="password"
            placeholder="Access Token"
            value={xAccessToken}
            onChange={(e) => setXAccessToken(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-x-access-secret">Access Token Secret</Label>
          <Input
            id="onboarding-x-access-secret"
            type="password"
            placeholder="Access Token Secret"
            value={xAccessTokenSecret}
            onChange={(e) => setXAccessTokenSecret(e.target.value)}
            disabled={isSaving}
          />
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
          Test connection
        </Button>
        <Button className="flex-1" onClick={onContinue} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
