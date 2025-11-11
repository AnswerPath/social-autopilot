-- Migration: Add Timezone Support and Job Queue Fields to scheduled_posts
-- Date: 2025-01-30
-- Description: Adds timezone support columns and job queue tracking fields for enhanced scheduling system

-- Add timezone support columns
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS user_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS scheduled_timezone TEXT DEFAULT 'UTC';

-- Add job queue tracking fields
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS conflict_window_minutes INTEGER DEFAULT 5;

-- Add index for queue processing (optimize queries for scheduled posts)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
ON scheduled_posts(status, scheduled_at) 
WHERE status IN ('scheduled', 'pending_approval');

-- Add index for conflict detection (optimize time range queries)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_scheduled_at 
ON scheduled_posts(user_id, scheduled_at)
WHERE status IN ('scheduled', 'pending_approval', 'approved');

