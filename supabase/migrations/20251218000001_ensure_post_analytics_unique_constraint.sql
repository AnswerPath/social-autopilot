-- Migration: Ensure post_analytics has unique constraint on (user_id, post_id)
-- Date: 2025-12-18
-- Description: Creates a named unique constraint if it doesn't exist to support ON CONFLICT in upserts

DO $$ 
DECLARE
    constraint_exists boolean;
    constraint_name text;
BEGIN
    -- Check if any unique constraint exists on (user_id, post_id)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'post_analytics'
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
            (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[1]) = 'user_id'
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[2]) = 'post_id'
        )
    ) INTO constraint_exists;
    
    -- Get the constraint name if it exists
    IF constraint_exists THEN
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'post_analytics'
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
            (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[1]) = 'user_id'
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[2]) = 'post_id'
        )
        LIMIT 1;
        
        RAISE NOTICE 'Unique constraint on (user_id, post_id) already exists: %', constraint_name;
    ELSE
        -- Drop any existing constraint with the same name (in case it's on different columns)
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Create a named unique constraint
        ALTER TABLE post_analytics 
        ADD CONSTRAINT post_analytics_user_id_post_id_key 
        UNIQUE (user_id, post_id);
        
        RAISE NOTICE 'Created unique constraint post_analytics_user_id_post_id_key on (user_id, post_id)';
    END IF;
END $$;

