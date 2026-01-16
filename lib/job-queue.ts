import { supabaseAdmin } from '@/lib/supabase'
import { postTweet } from '@/lib/twitter-api-node'

/**
 * Job queue service for processing scheduled posts
 */

export interface JobStatus {
  pending: number
  processing: number
  failed: number
  published: number
}

export interface QueueMetrics {
  totalJobs: number
  statusCounts: JobStatus
  oldestPendingJob?: Date
  recentFailures: number
}

/**
 * Calculate retry delay using exponential backoff
 * Note: retryCount is already incremented before calling this function
 */
export function calculateRetryDelay(retryCount: number): number {
  // Exponential backoff: 1min, 5min, 30min
  const delays = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000]
  // retryCount is already incremented, so subtract 1 to get correct index
  const index = Math.min(Math.max(retryCount - 1, 0), delays.length - 1)
  return delays[index]
}

/**
 * Check if a job should be retried
 */
export function shouldRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries
}

/**
 * Enqueue a job (mark as scheduled)
 */
export async function enqueueJob(postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'approved',
        retry_count: 0
      })
      .eq('id', postId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Process queue - find and process due jobs
 */
export async function processQueue(): Promise<{
  success: boolean
  processed: number
  results: Array<{ id: string; status: string; error?: string }>
}> {
  const now = new Date()
  const nowIso = now.toISOString()

  try {
    // Find jobs that are due (scheduled_at <= now) and in approved status
    // Also include pending_approval posts that are past due (for auto-approval in dev/demo mode)
    const { data: dueJobs, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .in('status', ['approved', 'pending_approval'])
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(50) // Process up to 50 jobs at a time

    if (fetchError) {
      throw new Error(`Failed to fetch due jobs: ${fetchError.message}`)
    }

    if (!dueJobs || dueJobs.length === 0) {
      return { success: true, processed: 0, results: [] }
    }

    const results: Array<{ id: string; status: string; error?: string }> = []

    // Process each job
    for (const job of dueJobs) {
      try {
        // Mark as processing (lock the job) - use conditional update to prevent race conditions
        // Only update if status is 'approved' or 'pending_approval' to prevent concurrent claims
        // For pending_approval posts past due, auto-approve them
        const { data: lockedJob, error: lockError } = await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'processing' })
          .eq('id', job.id)
          .in('status', ['approved', 'pending_approval'])
          .select('id')
          .single()

        if (lockError) {
          // If no rows were updated, another worker already claimed this job
          if (lockError.code === 'PGRST116') {
            results.push({
              id: job.id,
              status: 'skipped',
              error: 'Job already claimed by another worker'
            })
            continue
          }
          throw new Error(`Failed to lock job ${job.id}: ${lockError.message}`)
        }

        // If no data returned, job was already claimed
        if (!lockedJob) {
          results.push({
            id: job.id,
            status: 'skipped',
            error: 'Job already claimed by another worker'
          })
          continue
        }

        // Post the tweet
        // Only pass media_urls if it's a non-empty array
        const mediaIds = job.media_urls && job.media_urls.length > 0 
          ? job.media_urls 
          : undefined
        
        const postResult = await postTweet(
          job.content,
          mediaIds,
          job.user_id
        )

        if (postResult.success) {
          // Mark as published
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'published',
              posted_tweet_id: postResult.data?.id || null,
              retry_count: 0
            })
            .eq('id', job.id)

          results.push({
            id: job.id,
            status: 'published'
          })
        } else {
          // Handle failure with retry logic
          const maxRetries = job.max_retries || 3
          const retryCount = (job.retry_count || 0) + 1

          if (shouldRetry(retryCount, maxRetries)) {
            // Schedule retry with exponential backoff
            const retryDelay = calculateRetryDelay(retryCount)
            const retryTime = new Date(now.getTime() + retryDelay)

            await supabaseAdmin
              .from('scheduled_posts')
              .update({
                status: 'approved',
                retry_count: retryCount,
                last_retry_at: now.toISOString(),
                scheduled_at: retryTime.toISOString(),
                error: postResult.error || 'Unknown error'
              })
              .eq('id', job.id)

            results.push({
              id: job.id,
              status: 'scheduled_retry',
              error: `Retry ${retryCount}/${maxRetries}: ${postResult.error || 'Unknown error'}`
            })
          } else {
            // Mark as permanently failed
            await supabaseAdmin
              .from('scheduled_posts')
              .update({
                status: 'failed',
                error: postResult.error || 'Max retries exceeded',
                retry_count: retryCount
              })
              .eq('id', job.id)

            results.push({
              id: job.id,
              status: 'failed',
              error: `Max retries exceeded: ${postResult.error || 'Unknown error'}`
            })
          }
        }
      } catch (jobError) {
        // Job processing error
        const maxRetries = job.max_retries || 3
        const retryCount = (job.retry_count || 0) + 1
        const errorMessage = jobError instanceof Error ? jobError.message : 'Unknown error'

        if (shouldRetry(retryCount, maxRetries)) {
          const retryDelay = calculateRetryDelay(retryCount)
          const retryTime = new Date(now.getTime() + retryDelay)

          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'approved',
              retry_count: retryCount,
              last_retry_at: now.toISOString(),
              scheduled_at: retryTime.toISOString(),
              error: errorMessage
            })
            .eq('id', job.id)

          results.push({
            id: job.id,
            status: 'scheduled_retry',
            error: `Retry ${retryCount}/${maxRetries}: ${errorMessage}`
          })
        } else {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({
              status: 'failed',
              error: errorMessage,
              retry_count: retryCount
            })
            .eq('id', job.id)

          results.push({
            id: job.id,
            status: 'failed',
            error: `Max retries exceeded: ${errorMessage}`
          })
        }
      }
    }

    return {
      success: true,
      processed: results.length,
      results
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Queue processing failed: ${errorMessage}`)
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics(): Promise<QueueMetrics> {
  try {
    // Get status counts
    const { data: statusCounts, error: statusError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('status')

    if (statusError) {
      throw new Error(`Failed to get status counts: ${statusError.message}`)
    }

    const counts: JobStatus = {
      pending: 0,
      processing: 0,
      failed: 0,
      published: 0
    }

    interface JobStatusRow {
      status: string
    }

    statusCounts?.forEach((job: JobStatusRow) => {
      if (job.status === 'approved' || job.status === 'pending_approval') {
        counts.pending++
      } else if (job.status === 'processing') {
        counts.processing++
      } else if (job.status === 'failed') {
        counts.failed++
      } else if (job.status === 'published') {
        counts.published++
      }
    })

    // Get oldest pending job
    const { data: oldestPending } = await supabaseAdmin
      .from('scheduled_posts')
      .select('scheduled_at')
      .in('status', ['approved', 'pending_approval'])
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .single()

    // Get recent failures (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentFailures } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id')
      .eq('status', 'failed')
      .gte('updated_at', oneHourAgo)

    return {
      totalJobs: statusCounts?.length || 0,
      statusCounts: counts,
      oldestPendingJob: oldestPending?.scheduled_at ? new Date(oldestPending.scheduled_at) : undefined,
      recentFailures: recentFailures?.length || 0
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to get queue metrics: ${errorMessage}`)
  }
}

/**
 * Retry a failed job manually
 */
export async function retryFailedJob(postId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the job
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (fetchError || !job) {
      return { success: false, error: 'Job not found' }
    }

    if (job.status !== 'failed') {
      return { success: false, error: 'Job is not in failed status' }
    }

    const maxRetries = job.max_retries || 3
    const retryCount = job.retry_count || 0

    if (retryCount >= maxRetries) {
      return { success: false, error: 'Max retries exceeded' }
    }

    // Reset job for retry
    // Note: calculateRetryDelay expects the incremented retry count
    const nextRetryCount = retryCount + 1
    const retryDelay = calculateRetryDelay(nextRetryCount)
    const retryTime = new Date(Date.now() + retryDelay)

    const { error: updateError } = await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'approved',
        retry_count: nextRetryCount,
        last_retry_at: new Date().toISOString(),
        scheduled_at: retryTime.toISOString(),
        error: null
      })
      .eq('id', postId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}

/**
 * Cancel a scheduled job
 */
export async function cancelJob(postId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .update({
        status: 'cancelled'
      })
      .eq('id', postId)
      .eq('user_id', userId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
}


