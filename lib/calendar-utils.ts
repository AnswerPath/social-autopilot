import { formatInTimezone, convertFromUtc } from './timezone-utils'

/**
 * Calendar utility functions for calendar view operations
 */

export interface CalendarPost {
  id: string
  content: string
  scheduledAt: string
  status: 'draft' | 'scheduled' | 'pending_approval' | 'approved' | 'rejected' | 'changes_requested' | 'published' | 'failed'
  timezone?: string
  mediaUrls?: string[]
}

export interface CalendarDay {
  date: Date
  dayNumber: number | null
  posts: CalendarPost[]
  isToday: boolean
}

/**
 * Get status color for visual indicators
 */
export function getStatusColor(status: CalendarPost['status']): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 border-gray-300 text-gray-700'
    case 'scheduled':
      return 'bg-blue-50 border-blue-400 text-blue-700'
    case 'pending_approval':
      return 'bg-yellow-50 border-yellow-400 text-yellow-700'
    case 'approved':
      return 'bg-emerald-50 border-emerald-400 text-emerald-700'
    case 'rejected':
      return 'bg-red-50 border-red-400 text-red-700'
    case 'changes_requested':
      return 'bg-orange-50 border-orange-400 text-orange-700'
    case 'published':
      return 'bg-green-50 border-green-400 text-green-700'
    case 'failed':
      return 'bg-red-50 border-red-400 text-red-700'
    default:
      return 'bg-gray-50 border-gray-300 text-gray-600'
  }
}

/**
 * Get status badge variant
 */
export function getStatusBadgeVariant(status: CalendarPost['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'scheduled':
      return 'default'
    case 'pending_approval':
      return 'secondary'
    case 'approved':
      return 'outline'
    case 'rejected':
      return 'destructive'
    case 'changes_requested':
      return 'secondary'
    case 'failed':
      return 'destructive'
    case 'published':
      return 'outline'
    default:
      return 'secondary'
  }
}

/**
 * Format time for display in calendar
 */
export function formatPostTime(scheduledAt: string, timezone?: string): string {
  try {
    const date = new Date(scheduledAt)
    if (timezone) {
      return formatInTimezone(date, timezone, 'HH:mm')
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Check if a date is today
 */
export function isToday(date: Date, currentDate: Date): boolean {
  return (
    date.getDate() === currentDate.getDate() &&
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear()
  )
}

/**
 * Get posts for a specific date
 */
export function getPostsForDate(
  posts: CalendarPost[],
  year: number,
  month: number,
  day: number,
  userTimezone?: string
): CalendarPost[] {
  return posts.filter(post => {
    try {
      const postDate = userTimezone 
        ? convertFromUtc(new Date(post.scheduledAt), userTimezone)
        : new Date(post.scheduledAt)
      
      return (
        postDate.getFullYear() === year &&
        postDate.getMonth() === month &&
        postDate.getDate() === day
      )
    } catch {
      return false
    }
  }).sort((a, b) => {
    // Sort by scheduled time
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  })
}

/**
 * Calculate target date from drop position in calendar
 */
export function calculateTargetDateFromDrop(
  draggedPostId: string,
  targetDayNumber: number,
  currentMonth: Date,
  posts: CalendarPost[],
  userTimezone?: string
): { date: string; time: string } | null {
  try {
    // Find the original post to get its time
    const originalPost = posts.find(p => p.id === draggedPostId)
    if (!originalPost) return null

    // Convert to user's timezone to preserve the intended time
    const timezone = userTimezone || originalPost.timezone || 'UTC'
    const originalDateInTz = convertFromUtc(new Date(originalPost.scheduledAt), timezone)
    const originalHours = originalDateInTz.getHours()
    const originalMinutes = originalDateInTz.getMinutes()

    // Create new date for the target day
    const targetDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      targetDayNumber
    )
    targetDate.setHours(originalHours)
    targetDate.setMinutes(originalMinutes)

    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const hours = String(targetDate.getHours()).padStart(2, '0')
    const minutes = String(targetDate.getMinutes()).padStart(2, '0')

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    }
  } catch {
    return null
  }
}


