'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const ERROR_COPY: Record<string, string> = {
  twitter_oauth_failed:
    'Starting X authorization failed. Check that your X API Key and API Key Secret are correct, then try Connect with X again.',
  missing_consumer_keys:
    'Save your X API Key and API Key Secret in Settings → Integrations, then try Connect with X again.',
  session_required:
    'Your sign-in session ended before X authorization finished. Sign in again, then retry Connect with X.',
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get('error') || 'unknown'
  const message =
    ERROR_COPY[code] ??
    'Something went wrong during authentication. You can return to account settings and try again.'

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Connection issue</h1>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Button asChild>
          <Link href="/auth">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account-settings">Account settings</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/onboarding">Onboarding</Link>
        </Button>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  )
}
