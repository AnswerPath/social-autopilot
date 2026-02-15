'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OnboardingProgress } from './onboarding-progress'
import { Loader2, Zap, ArrowRight, ArrowLeft } from 'lucide-react'
import { ONBOARDING_STEPS } from '@/lib/onboarding'
import { StepConnectX } from './step-connect-x'
import { toast } from 'sonner'

interface OnboardingState {
  currentStep: number
  completed: boolean
  loading: boolean
}

export function OnboardingFlow() {
  const router = useRouter()
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    completed: false,
    loading: true,
  })

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/onboarding')
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false }))
        return
      }
      const data = await res.json()
      if (data.completed) {
        router.replace('/dashboard')
        return
      }
      setState((s) => ({
        ...s,
        currentStep: data.currentStep ?? 0,
        completed: !!data.completed,
        loading: false,
      }))
    } catch {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [])

  const updateStep = async (nextStep: number, markComplete = false) => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          markComplete ? { complete: true } : { step: nextStep }
        ),
      })
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false }))
        return
      }
      if (markComplete) {
        router.replace('/dashboard')
        return
      }
      setState((s) => ({ ...s, currentStep: nextStep, loading: false }))
    } catch {
      setState((s) => ({ ...s, loading: false }))
    }
  }

  const goToDashboard = () => updateStep(ONBOARDING_STEPS.COMPLETE, true)

  if (state.loading && state.currentStep === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex flex-col items-center justify-center">
      <OnboardingProgress currentStep={state.currentStep} className="mb-8" />

      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            {state.currentStep === ONBOARDING_STEPS.WELCOME && 'Welcome to Social Autopilot'}
            {state.currentStep === ONBOARDING_STEPS.CONNECT_X && 'Connect your X account'}
            {state.currentStep === ONBOARDING_STEPS.FEATURE_INTRO && 'You\'re all set'}
          </CardTitle>
          <CardDescription>
            {state.currentStep === ONBOARDING_STEPS.WELCOME &&
              'Schedule posts, automate engagement, and track analytics in one place.'}
            {state.currentStep === ONBOARDING_STEPS.CONNECT_X &&
              'Connect X to post, see mentions, and view analytics. You can skip and do this later in Settings.'}
            {state.currentStep === ONBOARDING_STEPS.FEATURE_INTRO &&
              'Take a quick tour of key features or go straight to your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {state.currentStep === ONBOARDING_STEPS.WELCOME && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Get started in a few steps: connect your X account, then explore scheduling, automation, and analytics.
              </p>
              <Button
                className="w-full"
                onClick={() => updateStep(ONBOARDING_STEPS.CONNECT_X)}
                disabled={state.loading}
              >
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {state.currentStep === ONBOARDING_STEPS.CONNECT_X && (
            <StepConnectX
              onSkip={() => updateStep(ONBOARDING_STEPS.FEATURE_INTRO)}
              onContinue={() => updateStep(ONBOARDING_STEPS.FEATURE_INTRO)}
              loading={state.loading}
            />
          )}

          {state.currentStep === ONBOARDING_STEPS.FEATURE_INTRO && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Need help? See our <Link href="/help" className="text-blue-600 hover:underline">FAQ</Link>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={goToDashboard}
                  disabled={state.loading}
                >
                  Go to dashboard
                </Button>
                <Button
                  className="flex-1"
                  onClick={async () => {
                    setState((s) => ({ ...s, loading: true }))
                    try {
                      const res = await fetch('/api/onboarding', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ complete: true }),
                      })
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}))
                        toast.error(data.error || 'Failed to save. Please try again.')
                        setState((s) => ({ ...s, loading: false }))
                        return
                      }
                      router.replace('/dashboard?tour=1')
                    } catch {
                      toast.error('Network error. Please try again.')
                      setState((s) => ({ ...s, loading: false }))
                    }
                  }}
                  disabled={state.loading}
                >
                  {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Take the tour'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {state.currentStep > ONBOARDING_STEPS.WELCOME && state.currentStep < ONBOARDING_STEPS.COMPLETE && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateStep(state.currentStep - 1)}
              disabled={state.loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
