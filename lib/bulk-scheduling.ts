import { addMinutes, addHours, addDays, addWeeks, isBefore, isAfter, parseISO } from 'date-fns'

/**
 * Bulk scheduling utilities for distributing posts across time ranges
 */

export type Frequency = 'daily' | 'weekly' | 'custom' | 'even'

export interface BulkScheduleConfig {
  startDate: string // YYYY-MM-DD
  startTime: string // HH:MM
  endDate: string // YYYY-MM-DD
  endTime: string // HH:MM
  frequency: Frequency
  customIntervalMinutes?: number
  timezone?: string
}

export interface PostToSchedule {
  content: string
  mediaUrls?: string[]
}

/**
 * Calculate scheduled times using even distribution algorithm
 */
export function calculateEvenDistribution(
  posts: PostToSchedule[],
  config: BulkScheduleConfig
): Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> {
  const start = parseISO(`${config.startDate}T${config.startTime}:00`)
  const end = parseISO(`${config.endDate}T${config.endTime}:00`)
  
  if (isBefore(end, start) || posts.length === 0) {
    return []
  }

  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  const intervalMinutes = totalMinutes / (posts.length + 1)

  return posts.map((post, index) => {
    const scheduledDate = addMinutes(start, Math.round(intervalMinutes * (index + 1)))
    const year = scheduledDate.getFullYear()
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0')
    const day = String(scheduledDate.getDate()).padStart(2, '0')
    const hours = String(scheduledDate.getHours()).padStart(2, '0')
    const minutes = String(scheduledDate.getMinutes()).padStart(2, '0')

    return {
      post,
      scheduledDate: `${year}-${month}-${day}`,
      scheduledTime: `${hours}:${minutes}`
    }
  })
}

/**
 * Calculate scheduled times using daily frequency
 */
export function calculateDailySchedule(
  posts: PostToSchedule[],
  config: BulkScheduleConfig
): Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> {
  const start = parseISO(`${config.startDate}T${config.startTime}:00`)
  const results: Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> = []

  let currentDate = start
  let postIndex = 0

  while (postIndex < posts.length) {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const hours = String(currentDate.getHours()).padStart(2, '0')
    const minutes = String(currentDate.getMinutes()).padStart(2, '0')

    const end = parseISO(`${config.endDate}T${config.endTime}:00`)
    if (isAfter(currentDate, end)) {
      break
    }

    results.push({
      post: posts[postIndex],
      scheduledDate: `${year}-${month}-${day}`,
      scheduledTime: `${hours}:${minutes}`
    })

    postIndex++
    currentDate = addDays(currentDate, 1)
    // Keep same time
    currentDate.setHours(parseInt(config.startTime.split(':')[0]))
    currentDate.setMinutes(parseInt(config.startTime.split(':')[1]))
  }

  return results
}

/**
 * Calculate scheduled times using weekly frequency
 */
export function calculateWeeklySchedule(
  posts: PostToSchedule[],
  config: BulkScheduleConfig
): Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> {
  const start = parseISO(`${config.startDate}T${config.startTime}:00`)
  const results: Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> = []

  let currentDate = start
  let postIndex = 0

  while (postIndex < posts.length) {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const hours = String(currentDate.getHours()).padStart(2, '0')
    const minutes = String(currentDate.getMinutes()).padStart(2, '0')

    const end = parseISO(`${config.endDate}T${config.endTime}:00`)
    if (isAfter(currentDate, end)) {
      break
    }

    results.push({
      post: posts[postIndex],
      scheduledDate: `${year}-${month}-${day}`,
      scheduledTime: `${hours}:${minutes}`
    })

    postIndex++
    currentDate = addWeeks(currentDate, 1)
    // Keep same time
    currentDate.setHours(parseInt(config.startTime.split(':')[0]))
    currentDate.setMinutes(parseInt(config.startTime.split(':')[1]))
  }

  return results
}

/**
 * Calculate scheduled times using custom interval
 */
export function calculateCustomIntervalSchedule(
  posts: PostToSchedule[],
  config: BulkScheduleConfig
): Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> {
  if (!config.customIntervalMinutes || config.customIntervalMinutes <= 0) {
    return []
  }

  const start = parseISO(`${config.startDate}T${config.startTime}:00`)
  const results: Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> = []

  let currentDate = start

  for (const post of posts) {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const hours = String(currentDate.getHours()).padStart(2, '0')
    const minutes = String(currentDate.getMinutes()).padStart(2, '0')

    const end = parseISO(`${config.endDate}T${config.endTime}:00`)
    if (isAfter(currentDate, end)) {
      break
    }

    results.push({
      post,
      scheduledDate: `${year}-${month}-${day}`,
      scheduledTime: `${hours}:${minutes}`
    })

    currentDate = addMinutes(currentDate, config.customIntervalMinutes)
  }

  return results
}

/**
 * Calculate scheduled times based on frequency type
 */
export function calculateBulkSchedule(
  posts: PostToSchedule[],
  config: BulkScheduleConfig
): Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }> {
  switch (config.frequency) {
    case 'even':
      return calculateEvenDistribution(posts, config)
    case 'daily':
      return calculateDailySchedule(posts, config)
    case 'weekly':
      return calculateWeeklySchedule(posts, config)
    case 'custom':
      return calculateCustomIntervalSchedule(posts, config)
    default:
      return calculateEvenDistribution(posts, config)
  }
}

/**
 * Validate bulk schedule configuration
 */
export function validateBulkScheduleConfig(
  config: BulkScheduleConfig,
  postCount: number
): { valid: boolean; error?: string } {
  if (postCount === 0) {
    return { valid: false, error: 'At least one post is required' }
  }

  const start = parseISO(`${config.startDate}T${config.startTime}:00`)
  const end = parseISO(`${config.endDate}T${config.endTime}:00`)

  if (isBefore(end, start) || end.getTime() === start.getTime()) {
    return { valid: false, error: 'End date/time must be after start date/time' }
  }

  if (config.frequency === 'custom' && (!config.customIntervalMinutes || config.customIntervalMinutes <= 0)) {
    return { valid: false, error: 'Custom interval must be greater than 0' }
  }

  // Check if there's enough time to schedule all posts
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  const minInterval = 5 // Minimum 5 minutes between posts
  
  if (config.frequency === 'custom' && config.customIntervalMinutes) {
    const requiredMinutes = config.customIntervalMinutes * (postCount - 1)
    if (requiredMinutes > totalMinutes) {
      return { valid: false, error: 'Not enough time in range to schedule all posts with the specified interval' }
    }
  } else if (postCount > 1 && totalMinutes < minInterval * (postCount - 1)) {
    return { valid: false, error: `Not enough time in range to schedule ${postCount} posts (minimum ${minInterval} minutes between posts)` }
  }

  return { valid: true }
}

