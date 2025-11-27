"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { Loader2, History } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PostRevision {
  id: string
  revision_number: number
  created_at: string
  author_id: string
  created_reason?: string | null
  summary?: string
}

interface VersionHistoryDialogProps {
  postId: string
}

export function VersionHistoryDialog({ postId }: VersionHistoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [revisions, setRevisions] = useState<PostRevision[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadRevisions()
    }
  }, [open])

  async function loadRevisions() {
    setLoading(true)
    try {
      const response = await fetch(`/api/approval?type=revisions&postId=${postId}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load revisions')
      }
      setRevisions(result.revisions || [])
    } catch (error) {
      toast({
        title: 'Failed to load revisions',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(revisionId: string) {
    setRestoring(revisionId)
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore-revision',
          postId,
          revisionId
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to restore revision')
      }
      toast({
        title: 'Revision restored',
        description: 'The post content was reverted to the selected revision.'
      })
      await loadRevisions()
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          Version History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revision History</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[20rem] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No revisions exist for this post yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {revisions.map((revision) => (
                <li
                  key={revision.id}
                  className="border rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {revision.summary || `Revision #${revision.revision_number}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(revision.created_at), 'PPpp')} — {revision.author_id}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {revision.created_reason || 'update'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestore(revision.id)}
                    disabled={restoring === revision.id}
                  >
                    {restoring === revision.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Restore'
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

