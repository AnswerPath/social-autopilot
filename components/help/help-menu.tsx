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
import { toast } from 'sonner'

export function HelpMenu() {
  const router = useRouter()

  const restartTutorial = async () => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetTutorial: true }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        console.error('Failed to reset tutorial:', data.error || response.statusText)
        toast.error(data.error || 'Failed to reset tutorial. Please try again.')
        return
      }
      router.push('/dashboard?tour=1')
    } catch (err) {
      console.error('Restart tutorial error:', err)
      toast.error('Network error. Please try again.')
    }
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
