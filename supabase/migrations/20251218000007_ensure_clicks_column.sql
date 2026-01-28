-- Migration: Ensure clicks column exists in post_analytics
-- Date: 2025-12-18
-- Description: Adds clicks column to post_analytics if it doesn't exist
-- This fixes the PostgREST schema cache issue where clicks column wasn't recognized

DO $$
BEGIN
    -- Check if clicks column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'clicks'
    ) THEN
        -- Add clicks column if it doesn't exist
        ALTER TABLE post_analytics 
        ADD COLUMN clicks INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added clicks column to post_analytics table';
    ELSE
        RAISE NOTICE 'clicks column already exists in post_analytics table';
    END IF;
END $$;

-- Note: After running this migration, you may need to refresh PostgREST schema cache
-- In Supabase, this is typically done automatically, but if issues persist:
-- 1. Restart your Supabase project
-- 2. Or wait for the schema cache to refresh (usually happens automatically)
