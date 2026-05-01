'use client'

import { useAuth } from '@/hooks/use-auth'
import { XApiSetupWizard } from '@/components/x-api-setup-wizard'

interface StepConnectXProps {
  onSkip: () => void
  onContinue: () => void
  loading: boolean
}

export function StepConnectX({ onSkip, onContinue, loading }: StepConnectXProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return (
    <XApiSetupWizard
      mode="onboarding"
      userId={userId}
      loading={loading}
      onSkip={onSkip}
      onContinue={onContinue}
    />
  )
}
