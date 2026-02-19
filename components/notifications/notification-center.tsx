'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, Check, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import type { NotificationEventType } from '@/lib/notifications/types'

interface NotificationItem {
  id: string
  recipient_id: string
  channel: string
  event_type: NotificationEventType
  notification_type: string
  payload: Record<string, unknown> | null
  post_id: string | null
  priority: string
  status: string
  read_at: string | null
  created_at: string
}

const EVENT_LABELS: Record<NotificationEventType, string> = {
  approval: 'Approvals',
  mention: 'Mentions',
  analytics: 'Analytics',
  system: 'System'
}

const POLL_INTERVAL_MS = 45000

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [marking, setMarking] = useState(false)
  const [eventFilter, setEventFilter] = useState<NotificationEventType | 'all'>('all')
  const { toast } = useToast()

  const limit = 20

  const loadNotifications = useCallback(
    async (reset = false) => {
      setLoading(true)
      const currentOffset = reset ? 0 : offset
      try {
        const params = new URLSearchParams()
        params.set('limit', String(limit))
        params.set('offset', String(currentOffset))
        if (eventFilter !== 'all') params.set('event_type', eventFilter)
        const response = await fetch(`/api/notifications?${params}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to fetch notifications')
        const list = (data.notifications || []) as NotificationItem[]
        setNotifications((prev) => (reset ? list : [...prev, ...list]))
        setUnreadCount(data.unreadCount ?? 0)
        setHasMore(data.hasMore ?? false)
        if (reset) setOffset(limit)
        else setOffset((o) => o + list.length)
      } catch (err) {
        toast({
          title: 'Notification error',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    },
    [eventFilter, offset, toast]
  )

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=1')
      const data = await res.json()
      if (res.ok && typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (open) loadNotifications(true)
  }, [open, eventFilter])

  useEffect(() => {
    if (!open) return
    const id = setInterval(loadUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [open, loadUnreadCount])

  async function markAllRead() {
    setMarking(true)
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-all-read',
          ...(eventFilter !== 'all' && { event_type: eventFilter })
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to mark read')
      setUnreadCount(data.unreadCount ?? 0)
      await loadNotifications(true)
    } catch (err) {
      toast({
        title: 'Failed to mark read',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setMarking(false)
    }
  }

  function formatNotificationType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  function getMessage(n: NotificationItem) {
    if (n.payload && typeof n.payload.stepName === 'string') {
      return `Step ${n.payload.stepName}`
    }
    if (n.event_type === 'approval') return 'Approval workflow update'
    if (n.event_type === 'mention') return 'New mention'
    if (n.event_type === 'analytics') return 'Analytics update'
    return 'Notification'
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Bell className="h-4 w-4 mr-2" />
          Notifications
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={markAllRead}
            disabled={marking || unreadCount === 0}
          >
            {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Mark all read
          </Button>
        </div>
        <Tabs
          value={eventFilter}
          onValueChange={(v) => setEventFilter(v as NotificationEventType | 'all')}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-4 rounded-none border-b h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="approval" className="text-xs">{EVENT_LABELS.approval}</TabsTrigger>
            <TabsTrigger value="mention" className="text-xs">{EVENT_LABELS.mention}</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">{EVENT_LABELS.analytics}</TabsTrigger>
          </TabsList>
        </Tabs>
        <ScrollArea className="h-72">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">You are all caught up!</div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {formatNotificationType(n.notification_type)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{getMessage(n)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant={n.read_at ? 'outline' : 'secondary'}>
                      {n.read_at ? 'Seen' : 'New'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasMore && (
            <div className="p-2 border-t flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => loadNotifications(false)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
              </Button>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
