'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth')
      return
    }
    fetch('/api/onboarding')
      .then((res) => (res.ok ? res.json() : { completed: true }))
      .then((data) => {
        setOnboardingChecked(true)
        if (data.completed) {
          router.push('/dashboard')
        } else {
          router.push('/onboarding')
        }
      })
      .catch(() => {
        setOnboardingChecked(true)
        router.push('/dashboard')
      })
  }, [user, loading, router])

  if (loading || (user && !onboardingChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return null
}
