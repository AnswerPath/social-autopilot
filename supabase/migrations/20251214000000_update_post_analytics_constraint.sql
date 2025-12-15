-- Migration: Update post_analytics unique constraint
-- Date: 2025-12-14
-- Description: Changes unique constraint from (post_id, collected_at) to (tweet_id, collected_at)
-- to support analytics for all tweets, not just scheduled posts

BEGIN;

-- Drop the old unique constraint
ALTER TABLE post_analytics DROP CONSTRAINT IF EXISTS post_analytics_post_id_collected_at_key;

-- Make post_id nullable (it already should be, but ensure it)
ALTER TABLE post_analytics ALTER COLUMN post_id DROP NOT NULL;

-- Add new unique constraint on (tweet_id, collected_at)
-- This allows multiple analytics records per tweet (at different collection times)
-- but prevents duplicates for the same tweet at the same collection time
ALTER TABLE post_analytics ADD CONSTRAINT post_analytics_tweet_id_collected_at_key 
  UNIQUE (tweet_id, collected_at);

-- Update the foreign key to allow nulls (if it doesn't already)
-- The foreign key constraint should already allow nulls, but we'll ensure it
ALTER TABLE post_analytics 
  DROP CONSTRAINT IF EXISTS post_analytics_post_id_fkey;

ALTER TABLE post_analytics
  ADD CONSTRAINT post_analytics_post_id_fkey 
  FOREIGN KEY (post_id) 
  REFERENCES scheduled_posts(id) 
  ON DELETE CASCADE;

COMMIT;
