-- Migration: Ensure tweet_id column exists in post_analytics
-- Date: 2025-12-18
-- Description: Adds tweet_id column if it doesn't exist, or ensures it's properly configured

DO $$ 
BEGIN
    -- Check if tweet_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'tweet_id'
    ) THEN
        -- Add tweet_id column as TEXT NOT NULL
        -- It should store the same value as post_id (the tweet ID)
        ALTER TABLE post_analytics 
        ADD COLUMN tweet_id TEXT NOT NULL;
        
        -- Populate tweet_id from post_id for existing rows
        UPDATE post_analytics 
        SET tweet_id = post_id 
        WHERE tweet_id IS NULL OR tweet_id = '';
        
        -- Create index on tweet_id for performance
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_id 
        ON post_analytics(tweet_id);
        
        RAISE NOTICE 'Added tweet_id column to post_analytics table and populated from post_id';
    ELSE
        -- Column exists, ensure it's NOT NULL and populated
        -- First, populate any NULL values from post_id
        UPDATE post_analytics 
        SET tweet_id = post_id 
        WHERE tweet_id IS NULL OR tweet_id = '';
        
        -- Then ensure it's NOT NULL
        ALTER TABLE post_analytics 
        ALTER COLUMN tweet_id SET NOT NULL;
        
        -- Ensure index exists
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_id 
        ON post_analytics(tweet_id);
        
        RAISE NOTICE 'tweet_id column already exists, ensured it is NOT NULL and populated';
    END IF;
END $$;

