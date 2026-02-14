'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { getTourSteps } from '@/lib/tour-steps'

export function FeatureTour() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const driverRef = useRef<ReturnType<typeof driver> | null>(null)

  useEffect(() => {
    const tourParam = searchParams.get('tour')
    if (tourParam !== '1') return

    const runTour = () => {
      const steps = getTourSteps()
      driverRef.current = driver({
        showProgress: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        doneBtnText: 'Done',
        steps,
        onDestroyed: async () => {
          try {
            const res = await fetch('/api/onboarding', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tutorialCompleted: true }),
            })
            if (!res.ok) {
              console.error('Failed to persist tutorial completion')
            }
          } catch (e) {
            console.error('Tutorial completion persist error', e)
          } finally {
            router.replace('/dashboard', { scroll: false })
          }
        },
      })
      driverRef.current.drive()
    }

    const t = setTimeout(runTour, 300)
    return () => {
      clearTimeout(t)
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [searchParams, router])

  return null
}
