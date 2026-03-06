'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'

type Status = 'idle' | 'loading' | 'success' | 'error' | 'missing_token'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'missing_token')
  const [message, setMessage] = useState<string>('')

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">
          {status === 'loading' && 'Verifying your email…'}
          {status === 'success' && 'Email verified'}
          {status === 'error' && 'Verification failed'}
          {status === 'missing_token' && 'Invalid link'}
        </h1>

        {status === 'loading' && (
          <p className="text-gray-600">Please wait.</p>
        )}

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
