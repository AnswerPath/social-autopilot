-- Migration: Ensure follower_analytics table exists
-- Date: 2025-12-15
-- Description: Idempotent migration to ensure follower_analytics table exists
-- This fixes the issue where the table might not have been created from the original migration

-- Create follower_analytics table if it doesn't exist
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_id ON follower_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_date ON follower_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_date ON follower_analytics(user_id, date DESC);

-- Create trigger for updated_at (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS update_follower_analytics_updated_at ON follower_analytics;
CREATE TRIGGER update_follower_analytics_updated_at 
    BEFORE UPDATE ON follower_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE follower_analytics ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists, then create
DROP POLICY IF EXISTS "Users can view their own follower_analytics" ON follower_analytics;
CREATE POLICY "Users can view their own follower_analytics" ON follower_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions (idempotent - safe to run multiple times)
GRANT ALL ON follower_analytics TO authenticated;
GRANT ALL ON follower_analytics TO anon;
