-- Migration: Ensure tweet_created_at column exists and is properly configured
-- Date: 2025-12-18
-- Description: Ensures tweet_created_at column exists in post_analytics table
-- This column stores the actual post date from X/Apify, not when analytics were collected

DO $$ 
BEGIN
    -- Check if tweet_created_at column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'tweet_created_at'
    ) THEN
        -- Add tweet_created_at column as TIMESTAMPTZ (nullable)
        ALTER TABLE post_analytics 
        ADD COLUMN tweet_created_at TIMESTAMPTZ;
        
        -- Create index on tweet_created_at for performance
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at 
        ON post_analytics(tweet_created_at DESC);
        
        -- Create composite index for user_id and tweet_created_at
        CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at 
        ON post_analytics(user_id, tweet_created_at DESC);
        
        RAISE NOTICE 'Added tweet_created_at column to post_analytics table';
    ELSE
        -- Column exists, ensure index exists
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at 
        ON post_analytics(tweet_created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at 
        ON post_analytics(user_id, tweet_created_at DESC);
        
        RAISE NOTICE 'tweet_created_at column already exists, ensured indexes are present';
    END IF;
END $$;

