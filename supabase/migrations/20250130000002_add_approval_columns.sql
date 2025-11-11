-- Migration: Add Approval Workflow Columns to scheduled_posts
-- Date: 2025-01-30
-- Description: Adds requires_approval and submitted_for_approval_at columns for approval workflow support

-- Add approval workflow columns
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ;

-- Add index for approval workflow queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_requires_approval 
ON scheduled_posts(requires_approval, status)
WHERE requires_approval = true;

