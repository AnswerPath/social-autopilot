'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

const STORAGE_KEY = 'pendingTeamInvite'

/**
 * Captures ?teamInvite=token from /auth and accepts the invitation after login/register.
 */
export function TeamInviteDeepLink() {
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const inFlight = useRef(false)
  const [storedInviteVersion, setStoredInviteVersion] = useState(0)

  useEffect(() => {
    const t = searchParams.get('teamInvite')
    if (!t) return

    sessionStorage.setItem(STORAGE_KEY, t)
    setStoredInviteVersion((v) => v + 1)

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('teamInvite')) {
        url.searchParams.delete('teamInvite')
        const next = `${url.pathname}${url.search}${url.hash}`
        window.history.replaceState(null, '', next)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (loading || !user) return

    const token = sessionStorage.getItem(STORAGE_KEY)
    if (!token || inFlight.current) return

    inFlight.current = true

    ;(async () => {
      try {
        const res = await fetch('/api/teams/invitations', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationToken: token })
        })
        const data = await res.json().catch(() => ({}))

        if (res.ok) {
          sessionStorage.removeItem(STORAGE_KEY)
          const name = data.team?.name
          toast.success(name ? `Joined ${name}` : 'Invitation accepted')
        } else {
          const terminal = res.status === 400 || res.status === 401 || res.status === 404
          if (terminal) {
            sessionStorage.removeItem(STORAGE_KEY)
          }
          const msg =
            typeof data.error === 'object' && data.error && 'message' in data.error
              ? String((data.error as { message?: string }).message)
              : 'Could not accept invitation'
          toast.error(msg)
        }
      } catch {
        toast.error('Could not accept invitation')
      } finally {
        inFlight.current = false
      }
    })()
  }, [user, loading, storedInviteVersion])

  return null
}
