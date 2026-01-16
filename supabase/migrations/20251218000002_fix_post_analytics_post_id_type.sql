-- Migration: Fix post_analytics post_id column type
-- Date: 2025-12-18
-- Description: Ensures post_id is TEXT (for tweet IDs) and not UUID, removes any incorrect foreign key constraints

DO $$ 
DECLARE
    current_type text;
    has_fk boolean;
    fk_name text;
    row_count integer;
BEGIN
    -- Check current data type of post_id
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'post_analytics' 
    AND column_name = 'post_id';
    
    -- Check if there's a foreign key constraint on post_id
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'post_analytics'
        AND kcu.column_name = 'post_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) INTO has_fk;
    
    -- Get foreign key name if it exists
    IF has_fk THEN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'post_analytics'
        AND kcu.column_name = 'post_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        RAISE NOTICE 'Found foreign key constraint on post_id: %. Dropping it...', fk_name;
        EXECUTE format('ALTER TABLE post_analytics DROP CONSTRAINT IF EXISTS %I', fk_name);
    END IF;
    
    -- If post_id is UUID, change it to TEXT
    -- NOTE: If post_id is UUID, it means the schema is wrong - post_id should store tweet IDs (TEXT)
    -- UUIDs and tweet IDs are incompatible formats, so we need to handle this carefully
    IF current_type = 'uuid' THEN
        RAISE NOTICE 'post_id is currently UUID (INCORRECT TYPE), converting to TEXT...';
        RAISE NOTICE 'WARNING: post_id should store tweet IDs (TEXT), not UUIDs. Converting type...';
        
        -- Check if there's existing data
        SELECT COUNT(*) INTO row_count FROM post_analytics;
        IF row_count > 0 THEN
            RAISE NOTICE 'Found % existing rows. UUID values in post_id cannot be preserved as tweet IDs.', row_count;
            RAISE NOTICE 'These rows will need to be re-synced with correct tweet IDs from the analytics source.';
        END IF;
        
        -- Drop any constraints that depend on post_id
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Change the column type to TEXT
        -- Since UUIDs and tweet IDs are incompatible, convert UUIDs to empty strings
        -- The data will need to be re-synced, but this prevents the type error
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id TYPE TEXT USING '';
        
        -- Set NOT NULL constraint (but allow empty strings temporarily for migration)
        -- Actually, we should allow NULL temporarily, then set NOT NULL after data is re-synced
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id DROP NOT NULL;
        
        RAISE NOTICE 'Converted post_id from UUID to TEXT. Existing rows have empty post_id and need re-sync.';
    ELSIF current_type IS NULL THEN
        RAISE NOTICE 'post_id column does not exist, creating as TEXT...';
        ALTER TABLE post_analytics 
        ADD COLUMN post_id TEXT NOT NULL;
    ELSIF current_type != 'text' THEN
        RAISE NOTICE 'post_id is currently %, converting to TEXT...', current_type;
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id TYPE TEXT USING post_id::text;
    ELSE
        RAISE NOTICE 'post_id is already TEXT, no change needed';
    END IF;
    
    -- Ensure post_id is NOT NULL (it should be) - but only if it's not already UUID (which we handle above)
    IF current_type != 'uuid' THEN
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id SET NOT NULL;
    END IF;
    
    -- Ensure scheduled_post_id is UUID (it should be)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id'
    ) THEN
        SELECT data_type INTO current_type
        FROM information_schema.columns
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id';
        
        IF current_type != 'uuid' THEN
            RAISE NOTICE 'scheduled_post_id is currently %, converting to UUID...', current_type;
            -- This might fail if there's invalid data, but scheduled_post_id should be nullable
            ALTER TABLE post_analytics 
            ALTER COLUMN scheduled_post_id TYPE UUID USING NULLIF(scheduled_post_id::text, '')::uuid;
        ELSE
            RAISE NOTICE 'scheduled_post_id is already UUID';
        END IF;
    END IF;
    
END $$;

-- Clean up invalid data and handle duplicates before creating unique constraint
DO $$
DECLARE
    duplicate_count integer;
    empty_post_id_count integer;
    current_type_check text;
BEGIN
    -- Check current type to see if we just converted from UUID
    SELECT data_type INTO current_type_check
    FROM information_schema.columns
    WHERE table_name = 'post_analytics' 
    AND column_name = 'post_id';
    -- Count rows with empty or NULL post_id
    SELECT COUNT(*) INTO empty_post_id_count 
    FROM post_analytics 
    WHERE post_id IS NULL OR post_id = '';
    
    IF empty_post_id_count > 0 THEN
        RAISE NOTICE 'Found % rows with empty/NULL post_id. These have invalid data and will be removed.', empty_post_id_count;
        
        -- Delete rows with empty or NULL post_id since they're invalid (can't be tweet IDs)
        DELETE FROM post_analytics 
        WHERE post_id IS NULL OR post_id = '';
        
        RAISE NOTICE 'Removed % invalid rows with empty post_id', empty_post_id_count;
    END IF;
    
    -- Check for remaining duplicates (shouldn't happen after cleanup, but be safe)
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, post_id, COUNT(*) as cnt
        FROM post_analytics
        WHERE post_id IS NOT NULL AND post_id != ''
        GROUP BY user_id, post_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate (user_id, post_id) combinations. Keeping only the most recent row for each...', duplicate_count;
        
        -- Delete duplicates, keeping only the most recent row (by collected_at or created_at)
        DELETE FROM post_analytics
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id, post_id 
                           ORDER BY COALESCE(collected_at, created_at) DESC
                       ) as rn
                FROM post_analytics
                WHERE post_id IS NOT NULL AND post_id != ''
            ) ranked
            WHERE rn > 1
        );
        
        RAISE NOTICE 'Removed duplicate rows, kept most recent for each (user_id, post_id) combination';
    END IF;
    
    -- After cleanup, ensure post_id is NOT NULL (if it's TEXT type)
    -- This is safe now because we've removed all NULL/empty values
    IF current_type_check = 'text' THEN
        -- Check if there are any NULL values remaining
        IF NOT EXISTS (SELECT 1 FROM post_analytics WHERE post_id IS NULL) THEN
            ALTER TABLE post_analytics 
            ALTER COLUMN post_id SET NOT NULL;
            RAISE NOTICE 'Set post_id to NOT NULL after cleanup';
        ELSE
            RAISE WARNING 'Cannot set post_id to NOT NULL: NULL values still exist';
        END IF;
    END IF;
END $$;

-- Recreate the unique constraint if it doesn't exist
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    -- Check if constraint already exists
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
    
    IF NOT constraint_exists THEN
        -- Drop constraint if it exists with different definition
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Only create constraint if there are no NULL or empty post_id values
        -- (We already cleaned those up, but double-check)
        IF NOT EXISTS (
            SELECT 1 FROM post_analytics 
            WHERE post_id IS NULL OR post_id = ''
        ) THEN
            ALTER TABLE post_analytics 
            ADD CONSTRAINT post_analytics_user_id_post_id_key 
            UNIQUE (user_id, post_id);
            
            RAISE NOTICE 'Created unique constraint on (user_id, post_id)';
        ELSE
            RAISE WARNING 'Cannot create unique constraint: rows with empty/NULL post_id still exist';
        END IF;
    ELSE
        RAISE NOTICE 'Unique constraint on (user_id, post_id) already exists';
    END IF;
END $$;

