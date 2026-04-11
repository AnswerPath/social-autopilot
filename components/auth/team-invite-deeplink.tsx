'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    const t = searchParams.get('teamInvite')
    if (t) {
      sessionStorage.setItem(STORAGE_KEY, t)
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
        sessionStorage.removeItem(STORAGE_KEY)

        if (res.ok) {
          const name = data.team?.name
          toast.success(name ? `Joined ${name}` : 'Invitation accepted')
        } else {
          const msg =
            typeof data.error === 'object' && data.error && 'message' in data.error
              ? String((data.error as { message?: string }).message)
              : 'Could not accept invitation'
          toast.error(msg)
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY)
        toast.error('Could not accept invitation')
      } finally {
        inFlight.current = false
      }
    })()
  }, [user, loading])

  return null
}
