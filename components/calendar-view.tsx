"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react'
import { PostComposer } from "./post-composer"
import { CalendarDay } from "./ui/calendar-day"
import { 
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { 
  CalendarPost, 
  getPostsForDate,
  calculateTargetDateFromDrop,
  isToday as isTodayCheck
} from "@/lib/calendar-utils"
import { useToast } from "@/hooks/use-toast"
import { getUserTimezone } from "@/lib/timezone-utils"

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showComposer, setShowComposer] = useState(false)
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null)

  const [scheduledPosts, setScheduledPosts] = useState<CalendarPost[]>([])
  const [tweets, setTweets] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activePost, setActivePost] = useState<CalendarPost | null>(null)
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  
  const { toast } = useToast()
  const userTimezone = getUserTimezone()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const visibleMonth = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0')
    return `${y}-${m}`
  }, [currentDate])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const postsRes = await fetch(`/api/scheduled-posts?month=${visibleMonth}`)
        if (postsRes.ok) {
          const { posts } = await postsRes.json()
          setScheduledPosts((posts || []).map((p: any) => ({
            id: p.id,
            content: p.content,
            scheduledAt: p.scheduled_at,
            status: p.status || 'scheduled',
            timezone: p.scheduled_timezone || p.user_timezone,
            mediaUrls: p.media_urls
          })))
        }
        // Fetch tweets for the visible month
        const [y, m] = visibleMonth.split('-').map(Number)
        const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString()
        const end = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString()
        const tweetsRes = await fetch(`/api/twitter/tweets?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
        if (tweetsRes.ok) {
          const data = await tweetsRes.json()
          setTweets(data.tweets || [])
        }
      } catch (e) {
        console.error('Calendar fetch error', e)
        toast({
          title: "Error",
          description: "Failed to load calendar data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [visibleMonth, toast])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: Array<number | null> = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return days
  }

  const getPostsForDateInCalendar = (day: number | null): CalendarPost[] => {
    if (!day) return []
    
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    
    // Get scheduled posts for this date
    const scheduled = getPostsForDate(scheduledPosts, y, m, day, userTimezone)
    
    // Get published tweets for this date
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const published = tweets
      .filter(t => t.created_at?.slice(0, 10) === dateStr)
      .map(t => ({
        id: t.id,
        content: t.text,
        scheduledAt: t.created_at,
        status: 'published' as const,
        timezone: userTimezone
      }))
    
    // Apply status filter
    const allPosts = [...scheduled, ...published]
    if (statusFilter) {
      return allPosts.filter(p => p.status === statusFilter)
    }
    
    return allPosts
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const post = scheduledPosts.find(p => p.id === active.id)
    if (post && post.status === 'scheduled') {
      setActivePost(post)
      setDraggingPostId(post.id)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActivePost(null)
    setDraggingPostId(null)

    if (!over || !active) return

    const draggedPost = scheduledPosts.find(p => p.id === active.id)
    if (!draggedPost || draggedPost.status !== 'scheduled') return

    // Find the target day from the over element
    const targetElement = over.data.current as { day?: number } | undefined
    const targetDay = targetElement?.day

    if (targetDay === undefined) return

    // Calculate new date/time
    const newDateTime = calculateTargetDateFromDrop(
      draggedPost.id,
      targetDay,
      currentDate,
      scheduledPosts
    )

    if (!newDateTime) {
      toast({
        title: "Error",
        description: "Failed to calculate new schedule time",
        variant: "destructive",
      })
      return
    }

    // Optimistic update
    const originalPosts = [...scheduledPosts]
    setScheduledPosts(prev => prev.map(p => 
      p.id === draggedPost.id 
        ? { ...p, scheduledAt: new Date(`${newDateTime.date}T${newDateTime.time}`).toISOString() }
        : p
    ))

    try {
      // Call API to reschedule
      const response = await fetch(`/api/scheduled-posts/${draggedPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: newDateTime.date,
          scheduledTime: newDateTime.time,
          timezone: userTimezone
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        // Rollback on error
        setScheduledPosts(originalPosts)
        toast({
          title: "Rescheduling Failed",
          description: result.error || "Failed to reschedule post",
          variant: "destructive",
        })
        return
      }

      // Update with server response
      setScheduledPosts(prev => prev.map(p => 
        p.id === draggedPost.id 
          ? { ...p, scheduledAt: result.post.scheduled_at, timezone: result.post.scheduled_timezone }
          : p
      ))

      toast({
        title: "Success",
        description: "Post rescheduled successfully",
      })
    } catch (error) {
      // Rollback on error
      setScheduledPosts(originalPosts)
      toast({
        title: "Error",
        description: "An unexpected error occurred while rescheduling",
        variant: "destructive",
      })
    }
  }

  const handlePostEdit = (post: CalendarPost) => {
    if (post.status === 'published') {
      toast({
        title: "Cannot Edit",
        description: "Published posts cannot be edited",
        variant: "destructive",
      })
      return
    }
    setEditingPost(post)
    setShowComposer(true)
  }

  const handlePostDelete = async (post: CalendarPost) => {
    if (post.status === 'published') {
      toast({
        title: "Cannot Delete",
        description: "Published posts cannot be deleted",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Are you sure you want to delete this scheduled post?`)) {
      return
    }

    try {
      const response = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete post')
      }

      setScheduledPosts(prev => prev.filter(p => p.id !== post.id))
      toast({
        title: "Success",
        description: "Post deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      })
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (showComposer) {
    return <PostComposer 
      onClose={() => {
        setShowComposer(false)
        setEditingPost(null)
        // Refresh data
        const fetchData = async () => {
          const postsRes = await fetch(`/api/scheduled-posts?month=${visibleMonth}`)
          if (postsRes.ok) {
            const { posts } = await postsRes.json()
            setScheduledPosts((posts || []).map((p: any) => ({
              id: p.id,
              content: p.content,
              scheduledAt: p.scheduled_at,
              status: p.status || 'scheduled',
              timezone: p.scheduled_timezone || p.user_timezone,
              mediaUrls: p.media_urls
            })))
          }
        }
        fetchData()
      }}
      editingPost={editingPost}
    />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <Button onClick={() => setShowComposer(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Post
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-4">
              {/* Day headers */}
              {dayNames.map(day => (
                <div key={day} className="text-center font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {getDaysInMonth(currentDate).map((day, index) => {
                const posts = getPostsForDateInCalendar(day)
                const today = new Date()
                const isToday = day !== null && isTodayCheck(
                  new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
                  today
                )
                
                return (
                  <CalendarDay
                    key={index}
                    day={day}
                    posts={posts}
                    isToday={isToday}
                    onPostClick={(post) => handlePostEdit(post)}
                    onPostEdit={handlePostEdit}
                    onPostDelete={handlePostDelete}
                    userTimezone={userTimezone}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Posts Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledPosts
                .filter(p => ['scheduled', 'pending_approval'].includes(p.status))
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .slice(0, 5)
                .map(post => {
                  const postDate = new Date(post.scheduledAt)
                  return (
                    <div key={post.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>Y</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium line-clamp-1">{post.content}</p>
                          <p className="text-xs text-gray-500">
                            {postDate.toLocaleDateString()} at {postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={post.status === "scheduled" ? "default" : "secondary"}>
                          {post.status === "pending_approval" ? "Pending Approval" : "Scheduled"}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handlePostEdit(post)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      <DragOverlay>
        {activePost ? (
          <div className="text-xs p-2 rounded border-l-2 bg-blue-50 border-blue-400 opacity-80 shadow-lg">
            <p className="line-clamp-2 text-gray-700">{activePost.content}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
