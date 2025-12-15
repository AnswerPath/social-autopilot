-- Migration: Analytics Data Processing Pipeline
-- Date: 2025-02-01
-- Description: Creates tables for X API post analytics, follower analytics, and sync job tracking

BEGIN;

-- ========================================
-- 1. Create post_analytics table
-- ========================================

CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL, -- X tweet ID
    scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL, -- Optional FK, NULL for posts not created through app
    tweet_text TEXT, -- Store tweet content for reference
    tweet_created_at TIMESTAMPTZ, -- Original tweet timestamp from X
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(10, 4) DEFAULT 0.0, -- Calculated: (likes + retweets + replies + quotes) / impressions
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- Prevent duplicate analytics for same post
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_user_id ON post_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_collected_at ON post_analytics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_scheduled_post_id ON post_analytics(scheduled_post_id) WHERE scheduled_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at ON post_analytics(tweet_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at ON post_analytics(user_id, tweet_created_at DESC);

CREATE TRIGGER update_post_analytics_updated_at 
    BEFORE UPDATE ON post_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own post_analytics" ON post_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON post_analytics TO authenticated;
GRANT ALL ON post_analytics TO anon;

-- ========================================
-- 2. Create follower_analytics table
-- ========================================

CREATE TABLE IF NOT EXISTS follower_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tweet_count INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date) -- One record per user per day
);

CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_id ON follower_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_date ON follower_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_date ON follower_analytics(user_id, date DESC);

CREATE TRIGGER update_follower_analytics_updated_at 
    BEFORE UPDATE ON follower_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE follower_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own follower_analytics" ON follower_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON follower_analytics TO authenticated;
GRANT ALL ON follower_analytics TO anon;

-- ========================================
-- 3. Create analytics_sync_jobs table
-- ========================================

CREATE TABLE IF NOT EXISTS analytics_sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('post_analytics', 'follower_analytics', 'both')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    posts_processed INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    sync_options JSONB, -- Store sync options like {days: 7, syncAll: false}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_user_id ON analytics_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_status ON analytics_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_created_at ON analytics_sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_user_status ON analytics_sync_jobs(user_id, status);

CREATE TRIGGER update_analytics_sync_jobs_updated_at 
    BEFORE UPDATE ON analytics_sync_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE analytics_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own analytics_sync_jobs" ON analytics_sync_jobs
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON analytics_sync_jobs TO authenticated;
GRANT ALL ON analytics_sync_jobs TO anon;

COMMIT;
