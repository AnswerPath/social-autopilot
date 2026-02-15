'use client'

import { cn } from '@/lib/utils'

const STEPS = [
  { key: 0, label: 'Welcome' },
  { key: 1, label: 'Connect X' },
  { key: 2, label: 'Tour' },
  { key: 3, label: 'Done' },
]

interface OnboardingProgressProps {
  currentStep: number
  className?: string
}

export function OnboardingProgress({ currentStep, className }: OnboardingProgressProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)} aria-label="Onboarding progress">
      {STEPS.map(({ key }) => (
        <div
          key={key}
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            key < currentStep && 'bg-blue-600',
            key === currentStep && 'bg-blue-600 ring-2 ring-blue-300 ring-offset-2',
            key > currentStep && 'bg-gray-200'
          )}
          aria-current={key === currentStep ? 'step' : undefined}
        />
      ))}
    </div>
  )
}
