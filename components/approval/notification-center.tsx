"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface NotificationItem {
  id: string
  post_id?: string | null
  notification_type: string
  created_at: string
  payload?: Record<string, any> | null
  status: 'pending' | 'sent' | 'failed'
  read_at?: string | null
}

export function ApprovalNotificationCenter() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [marking, setMarking] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadNotifications()
    }
  }, [open])

  async function loadNotifications() {
    setLoading(true)
    try {
      const response = await fetch('/api/approval?type=notifications')
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Unable to fetch notifications')
      }
      setNotifications(result.notifications || [])
    } catch (error) {
      toast({
        title: 'Notification error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    if (!notifications.length) return
    setMarking(true)
    try {
      const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
      if (!unreadIds.length) return

      const response = await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notifications-read',
          notificationIds: unreadIds
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update notifications')
      }
      await loadNotifications()
    } catch (error) {
      toast({
        title: 'Failed to mark read',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setMarking(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4 mr-2" />
          Notifications
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="text-sm font-medium">Approval Notifications</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={markAllRead}
            disabled={marking || unreadCount === 0}
          >
            {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Mark read
          </Button>
        </div>
        <ScrollArea className="h-72">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">You are all caught up!</div>
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id} className="px-4 py-3 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {formatNotification(notification.notification_type)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.payload?.stepName
                          ? `Step ${notification.payload.stepName}`
                          : 'Approval workflow update'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={notification.read_at ? 'outline' : 'secondary'}>
                      {notification.read_at ? 'Seen' : 'New'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function formatNotification(type: string) {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

