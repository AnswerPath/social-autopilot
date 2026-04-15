'use client'

import { Suspense } from 'react'
import { TeamInviteDeepLink } from '@/components/auth/team-invite-deeplink'

/** Runs app-wide so invite acceptance can run after login once `useAuth` has the user (avoids racing `router.push` on the auth page). */
export function GlobalTeamInviteDeepLink() {
  return (
    <Suspense fallback={null}>
      <TeamInviteDeepLink />
    </Suspense>
  )
}
