'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Status = 'idle' | 'loading' | 'success' | 'error' | 'missing_token'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'missing_token')
  const [message, setMessage] = useState<string>('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resendHint, setResendHint] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    setStatus('loading')

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setStatus('success')
          setMessage(data.message || 'Email verified successfully.')
        } else {
          setStatus('error')
          setMessage(data.error || 'Verification failed.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  async function resendWithSession() {
    setResendBusy(true)
    setResendHint(null)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 400) {
        const err = typeof data.error === 'string' ? data.error : ''
        if (err === 'EMAIL_REQUIRED') {
          setShowEmailForm(true)
          setResendHint(
            typeof data.message === 'string'
              ? data.message
              : 'Enter your email below to receive a new link.'
          )
          return
        }
      }
      if (!res.ok) {
        setResendHint(typeof data.message === 'string' ? data.message : 'Could not send email.')
        return
      }
      setResendHint(typeof data.message === 'string' ? data.message : 'Verification email sent.')
    } catch {
      setResendHint('Could not send email. Try again later.')
    } finally {
      setResendBusy(false)
    }
  }

  async function resendWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail.trim()) return
    setResendBusy(true)
    setResendHint(null)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim() })
      })
      const data = await res.json().catch(() => ({}))
      setResendHint(
        typeof data.message === 'string'
          ? data.message
          : 'If an account exists for that email, check your inbox.'
      )
    } catch {
      setResendHint('Could not send. Try again later.')
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          {status === 'loading' && 'Verifying your email…'}
          {status === 'success' && 'Email verified'}
          {status === 'error' && 'Verification failed'}
          {status === 'missing_token' && 'Invalid link'}
        </h1>

        {status === 'loading' && <p className="text-gray-600">Please wait.</p>}

        {status === 'success' && (
          <>
            <p className="text-gray-600">{message}</p>
            <Link
              href="/"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="text-gray-600">{message}</p>
            <div className="space-y-4 text-left pt-2">
              <p className="text-sm text-gray-600">
                Need a new link? We can send another verification email.
              </p>
              <Button type="button" onClick={resendWithSession} disabled={resendBusy} className="w-full">
                {resendBusy ? 'Sending…' : 'Resend verification email'}
              </Button>
              {showEmailForm && (
                <form onSubmit={resendWithEmail} className="space-y-2">
                  <Label htmlFor="resend-email">Email address</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    autoComplete="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  <Button type="submit" variant="secondary" disabled={resendBusy} className="w-full">
                    Send link to this email
                  </Button>
                </form>
              )}
              {resendHint && <p className="text-sm text-gray-700">{resendHint}</p>}
            </div>
            <Link
              href="/auth"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </Link>
          </>
        )}

        {status === 'missing_token' && (
          <>
            <p className="text-gray-600">This link is invalid or has already been used.</p>
            <Link
              href="/auth"
              className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Loading…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
