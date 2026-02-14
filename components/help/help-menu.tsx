'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HelpCircle, BookOpen, RotateCcw } from 'lucide-react'

export function HelpMenu() {
  const router = useRouter()

  const restartTutorial = async () => {
    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetTutorial: true }),
    })
    router.push('/dashboard?tour=1')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Help menu">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href="/help" className="flex items-center gap-2 cursor-pointer">
            <BookOpen className="h-4 w-4" />
            FAQ
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={restartTutorial} className="flex items-center gap-2 cursor-pointer">
          <RotateCcw className="h-4 w-4" />
          Restart tutorial
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
