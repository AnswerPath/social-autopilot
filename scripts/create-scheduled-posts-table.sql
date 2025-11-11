-- Complete scheduled_posts table setup with timezone support
-- Run this in your Supabase SQL Editor

-- Step 1: Create the base table if it doesn't exist
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT[],
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | pending_approval | published | failed
    posted_tweet_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add timezone support columns
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS user_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS scheduled_timezone TEXT DEFAULT 'UTC';

-- Step 3: Add job queue tracking fields
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS conflict_window_minutes INTEGER DEFAULT 5;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_time ON scheduled_posts(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
ON scheduled_posts(status, scheduled_at) 
WHERE status IN ('scheduled', 'pending_approval');

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_scheduled_at 
ON scheduled_posts(user_id, scheduled_at)
WHERE status IN ('scheduled', 'pending_approval', 'approved');

-- Step 5: Create update trigger (if function exists)
DROP TRIGGER IF EXISTS update_scheduled_posts_updated_at ON scheduled_posts;
CREATE TRIGGER update_scheduled_posts_updated_at 
    BEFORE UPDATE ON scheduled_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Enable RLS and create policy
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for demo (scheduled_posts)" ON scheduled_posts;
CREATE POLICY "Allow all operations for demo (scheduled_posts)" ON scheduled_posts
    FOR ALL USING (true);

-- Step 7: Grant permissions
GRANT ALL ON scheduled_posts TO authenticated;
GRANT ALL ON scheduled_posts TO anon;

