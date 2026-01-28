-- Migration: Add scheduled_post_id column to post_analytics table
-- Date: 2025-12-16
-- Description: Adds scheduled_post_id column if it doesn't exist to support linking analytics to scheduled posts

-- Add scheduled_post_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id'
    ) THEN
        ALTER TABLE post_analytics 
        ADD COLUMN scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL;
        
        -- Create index for scheduled_post_id if it doesn't exist
        CREATE INDEX IF NOT EXISTS idx_post_analytics_scheduled_post_id 
        ON post_analytics(scheduled_post_id) 
        WHERE scheduled_post_id IS NOT NULL;
        
        RAISE NOTICE 'Added scheduled_post_id column to post_analytics table';
    ELSE
        RAISE NOTICE 'Column scheduled_post_id already exists in post_analytics table';
    END IF;
END $$;

