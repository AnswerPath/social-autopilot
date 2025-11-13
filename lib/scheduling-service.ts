import { supabaseAdmin } from '@/lib/supabase'
import { convertToUtc, convertFromUtc, formatInTimezone, getUserTimezone } from './timezone-utils'
import { differenceInMinutes, isAfter, isFuture } from 'date-fns'

/**
 * Scheduling service for managing scheduled posts with timezone support and conflict detection
 */

export interface SchedulePostInput {
  content: string
  mediaUrls?: string[]
  scheduledDate: string // YYYY-MM-DD
  scheduledTime: string // HH:MM
  timezone?: string
  userId: string
  status?: 'draft' | 'scheduled' | 'pending_approval'
  requiresApproval?: boolean
}

export interface ConflictCheck {
  hasConflict: boolean
  conflicts: Array<{
    id: string
    scheduledAt: string
    content: string
  }>
}

export interface SchedulePostResult {
  success: boolean
  post?: unknown
  error?: string
  conflictCheck?: ConflictCheck
}

export class SchedulingService {
  private readonly conflictWindowMinutes: number = 5 // Default: 5 minutes

  /**
   * Validate that the scheduled time is in the future
   */
  validateScheduleTime(scheduledAt: Date): { valid: boolean; error?: string } {
    const now = new Date()
    
    if (!isFuture(scheduledAt)) {
      return {
        valid: false,
        error: 'Scheduled time must be in the future'
      }
    }

    // Check if it's too far in the future (e.g., more than 1 year)
    const oneYearFromNow = new Date()
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
    
    if (isAfter(scheduledAt, oneYearFromNow)) {
      return {
        valid: false,
        error: 'Scheduled time cannot be more than 1 year in the future'
      }
    }

    return { valid: true }
  }

  /**
   * Check for scheduling conflicts within the conflict window
   */
  async detectConflicts(
    userId: string,
    scheduledAt: Date,
    excludePostId?: string,
    conflictWindowMinutes: number = this.conflictWindowMinutes
  ): Promise<ConflictCheck> {
    try {
      // Calculate conflict window boundaries
      const windowStart = new Date(scheduledAt)
      windowStart.setMinutes(windowStart.getMinutes() - conflictWindowMinutes)
      
      const windowEnd = new Date(scheduledAt)
      windowEnd.setMinutes(windowEnd.getMinutes() + conflictWindowMinutes)

      // Query for posts in the conflict window
      let query = supabaseAdmin
        .from('scheduled_posts')
        .select('id, scheduled_at, content, status')
        .eq('user_id', userId)
        .gte('scheduled_at', windowStart.toISOString())
        .lte('scheduled_at', windowEnd.toISOString())
        .in('status', ['scheduled', 'pending_approval', 'approved'])

      if (excludePostId) {
        query = query.neq('id', excludePostId)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to check conflicts: ${error.message}`)
      }

      const conflicts = (data || []).map(post => ({
        id: post.id,
        scheduledAt: post.scheduled_at,
        content: post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '')
      }))

      return {
        hasConflict: conflicts.length > 0,
        conflicts
      }
    } catch (error) {
      throw new Error(`Conflict detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Schedule a post with timezone support and conflict detection
   */
  async schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
    try {
      const timezone = input.timezone || getUserTimezone()
      
      // Convert user-selected time to UTC
      const scheduledAtUtc = convertToUtc(
        input.scheduledDate,
        input.scheduledTime,
        timezone
      )

      // Validate schedule time
      const validation = this.validateScheduleTime(scheduledAtUtc)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }

      // Check for conflicts
      const conflictCheck = await this.detectConflicts(
        input.userId,
        scheduledAtUtc
      )

      if (conflictCheck.hasConflict) {
        return {
          success: false,
          error: `Scheduling conflict detected. Another post is scheduled within ${this.conflictWindowMinutes} minutes.`,
          conflictCheck
        }
      }

      // Determine initial status
      let initialStatus = input.status || 'scheduled'
      let requiresApproval = input.requiresApproval || false

      // Check if approval is required based on content
      if (!input.requiresApproval && (
        input.content.length > 200 ||
        input.content.toLowerCase().includes('sale') ||
        input.content.toLowerCase().includes('discount') ||
        (input.mediaUrls && input.mediaUrls.length > 0)
      )) {
        initialStatus = 'pending_approval'
        requiresApproval = true
      }

      // Insert scheduled post
      const { data, error } = await supabaseAdmin
        .from('scheduled_posts')
        .insert({
          user_id: input.userId,
          content: input.content.trim(),
          media_urls: Array.isArray(input.mediaUrls) ? input.mediaUrls : null,
          scheduled_at: scheduledAtUtc.toISOString(),
          user_timezone: timezone,
          scheduled_timezone: timezone,
          status: initialStatus,
          requires_approval: requiresApproval,
          submitted_for_approval_at: initialStatus === 'pending_approval' ? new Date().toISOString() : null,
          conflict_window_minutes: this.conflictWindowMinutes
        })
        .select('*')
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        post: data,
        conflictCheck
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule post'
      }
    }
  }

  /**
   * Reschedule an existing post
   */
  async reschedulePost(
    postId: string,
    userId: string,
    newScheduledDate: string,
    newScheduledTime: string,
    timezone?: string
  ): Promise<SchedulePostResult> {
    try {
      const tz = timezone || getUserTimezone()
      const newScheduledAtUtc = convertToUtc(newScheduledDate, newScheduledTime, tz)

      // Validate schedule time
      const validation = this.validateScheduleTime(newScheduledAtUtc)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        }
      }

      // Check for conflicts (excluding the current post)
      const conflictCheck = await this.detectConflicts(
        userId,
        newScheduledAtUtc,
        postId
      )

      if (conflictCheck.hasConflict) {
        return {
          success: false,
          error: `Scheduling conflict detected. Another post is scheduled within ${this.conflictWindowMinutes} minutes.`,
          conflictCheck
        }
      }

      // Update the post
      const { data, error } = await supabaseAdmin
        .from('scheduled_posts')
        .update({
          scheduled_at: newScheduledAtUtc.toISOString(),
          scheduled_timezone: tz,
          user_timezone: tz
        })
        .eq('id', postId)
        .eq('user_id', userId)
        .select('*')
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        post: data,
        conflictCheck
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule post'
      }
    }
  }

  /**
   * Get timezone-aware scheduled post
   */
  async getPost(postId: string, userId: string): Promise<unknown | null> {
    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .single()

    if (error) {
      throw new Error(`Failed to get post: ${error.message}`)
    }

    return data
  }
}


