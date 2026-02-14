'use client'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { getHelpForSection } from '@/lib/help-content'

interface ContextualHelpProps {
  sectionId: string
  className?: string
}

export function ContextualHelp({ sectionId, className }: ContextualHelpProps) {
  const help = getHelpForSection(sectionId)
  if (!help) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Contextual help"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-medium">{help.title}</h4>
          <p className="text-sm text-muted-foreground">{help.body}</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
