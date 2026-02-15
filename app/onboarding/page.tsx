'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingFlow />
    </ProtectedRoute>
  )
}
