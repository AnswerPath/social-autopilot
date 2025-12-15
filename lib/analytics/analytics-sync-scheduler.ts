/**
 * Analytics Sync Scheduler
 * Handles scheduled and manual analytics sync jobs
 */

import { createXApiAnalyticsProcessor, XApiAnalyticsProcessor } from './x-api-analytics-processor';
import { supabaseAdmin } from '../supabase';

export interface SyncOptions {
  days?: number;
  syncAll?: boolean;
}

export interface SyncJobResult {
  success: boolean;
  jobId: string;
  postsProcessed?: number;
  error?: string;
}

/**
 * Analytics Sync Scheduler
 */
export class AnalyticsSyncScheduler {
  private processor: XApiAnalyticsProcessor;

  constructor() {
    this.processor = createXApiAnalyticsProcessor();
  }

  /**
   * Execute sync for a user
   */
  async syncUserAnalytics(
    userId: string,
    jobType: 'post_analytics' | 'follower_analytics' | 'both',
    options?: SyncOptions
  ): Promise<SyncJobResult> {
    // Create sync job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('analytics_sync_jobs')
      .insert({
        user_id: userId,
        job_type: jobType,
        status: 'running',
        started_at: new Date().toISOString(),
        sync_options: options || {},
      })
      .select()
      .single();

    if (jobError || !job) {
      return {
        success: false,
        jobId: '',
        error: `Failed to create sync job: ${jobError?.message || 'Unknown error'}`,
      };
    }

    const jobId = job.id;

    try {
      let postsProcessed = 0;
      let totalPosts = 0;

      // Initialize processor
      const initResult = await this.processor.initialize(userId);
      if (!initResult.success) {
        await this.updateJobStatus(jobId, 'failed', initResult.error);
        return {
          success: false,
          jobId,
          error: initResult.error,
        };
      }

      // Process follower analytics if needed
      if (jobType === 'follower_analytics' || jobType === 'both') {
        const followerResult = await this.processor.processFollowerAnalytics(userId);
        if (!followerResult.success) {
          console.error('Follower analytics processing failed:', followerResult.error);
          // Continue with post analytics even if follower analytics fails
        }
      }

      // Process post analytics if needed
      if (jobType === 'post_analytics' || jobType === 'both') {
        const startTime = options?.days
          ? new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)
          : undefined;
        const endTime = new Date();

        const postResult = await this.processor.processPostAnalytics(userId, undefined, {
          startTime,
          endTime,
          syncAll: options?.syncAll || false,
          limit: options?.syncAll ? 3200 : 100,
        });

        if (postResult.success) {
          postsProcessed = postResult.postsProcessed;
          totalPosts = postResult.postsProcessed + postResult.postsSkipped + postResult.postsFailed;
        } else {
          await this.updateJobStatus(jobId, 'failed', postResult.error);
          return {
            success: false,
            jobId,
            error: postResult.error,
          };
        }
      }

      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed', undefined, postsProcessed, totalPosts);

      return {
        success: true,
        jobId,
        postsProcessed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.updateJobStatus(jobId, 'failed', errorMessage);
      return {
        success: false,
        jobId,
        error: errorMessage,
      };
    }
  }

  /**
   * Update sync job status
   */
  private async updateJobStatus(
    jobId: string,
    status: 'running' | 'completed' | 'failed',
    errorMessage?: string,
    postsProcessed?: number,
    totalPosts?: number
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (postsProcessed !== undefined) {
      updateData.posts_processed = postsProcessed;
    }

    if (totalPosts !== undefined) {
      updateData.total_posts = totalPosts;
    }

    await supabaseAdmin
      .from('analytics_sync_jobs')
      .update(updateData)
      .eq('id', jobId);
  }

  /**
   * Retry failed sync jobs
   */
  async retryFailedSyncs(userId?: string): Promise<number> {
    try {
      let query = supabaseAdmin
        .from('analytics_sync_jobs')
        .select('*')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(10); // Retry up to 10 failed jobs

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: failedJobs, error } = await query;

      if (error || !failedJobs) {
        console.error('Error fetching failed sync jobs:', error);
        return 0;
      }

      let retried = 0;
      for (const job of failedJobs) {
        try {
          const result = await this.syncUserAnalytics(
            job.user_id,
            job.job_type as 'post_analytics' | 'follower_analytics' | 'both',
            job.sync_options as SyncOptions
          );

          if (result.success) {
            retried++;
          }
        } catch (error) {
          console.error(`Error retrying job ${job.id}:`, error);
        }
      }

      return retried;
    } catch (error) {
      console.error('Error in retryFailedSyncs:', error);
      return 0;
    }
  }

  /**
   * Get sync job status
   */
  async getJobStatus(jobId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('analytics_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Get sync job history for a user
   */
  async getJobHistory(userId: string, limit: number = 10): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('analytics_sync_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data;
  }
}

/**
 * Factory function to create a scheduler instance
 */
export function createAnalyticsSyncScheduler(): AnalyticsSyncScheduler {
  return new AnalyticsSyncScheduler();
}
