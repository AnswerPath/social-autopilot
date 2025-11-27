"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { Loader2, MessageSquare, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ApprovalComment {
  id: string
  user_id: string
  comment: string
  comment_type: string
  created_at: string
  is_resolved: boolean
  resolved_at?: string | null
  resolved_by?: string | null
}

interface ApprovalCommentPanelProps {
  postId: string
}

export function ApprovalCommentPanel({ postId }: ApprovalCommentPanelProps) {
  const [comments, setComments] = useState<ApprovalComment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [commentText, setCommentText] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    loadComments()
  }, [postId])

  async function loadComments() {
    if (!postId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/approval?type=comments&postId=${postId}`)
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load comments')
      }
      setComments(result.comments || [])
    } catch (error) {
      toast({
        title: 'Failed to load comments',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          postId,
          comment: commentText.trim()
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Unable to add comment')
      }
      setCommentText('')
      await loadComments()
    } catch (error) {
      toast({
        title: 'Failed to add comment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function resolve(commentId: string) {
    try {
      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve-comment',
          commentId
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to resolve comment')
      }
      await loadComments()
    } catch (error) {
      toast({
        title: 'Failed to resolve comment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Review Comments
          <Badge variant="outline">{comments.filter((c) => !c.is_resolved).length} open</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-48 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No comments yet. Collaborators will leave feedback here.
            </p>
          ) : (
            <ul className="divide-y">
              {comments.map((comment) => (
                <li key={comment.id} className="p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>@{comment.user_id}</span>
                    <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm">{comment.comment}</p>
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant={comment.is_resolved ? 'outline' : 'secondary'}>
                      {comment.is_resolved ? 'Resolved' : comment.comment_type}
                    </Badge>
                    {!comment.is_resolved && (
                      <Button variant="ghost" size="sm" onClick={() => resolve(comment.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            placeholder="Leave feedback for the author..."
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !commentText.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Comment'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

