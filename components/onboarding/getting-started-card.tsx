'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle, Circle, RotateCcw, BookOpen } from 'lucide-react'

export function GettingStartedCard() {
  const [data, setData] = useState<{
    completed?: boolean
    tutorialCompleted?: boolean
  } | null>(null)

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data || !data.completed) return null

  const restartTutorial = () => {
    fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetTutorial: true }),
    }).then(() => {
      window.location.href = '/dashboard?tour=1'
    })
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Getting started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {data.tutorialCompleted ? (
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={data.tutorialCompleted ? 'text-muted-foreground' : ''}>
            {data.tutorialCompleted ? 'Product tour completed' : 'Complete the product tour'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={restartTutorial}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Restart tutorial
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/help">
              <BookOpen className="h-3 w-3 mr-1" />
              FAQ
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
