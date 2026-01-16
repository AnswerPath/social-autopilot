-- Fix: Add 'processing' and 'cancelled' status to scheduled_posts status constraint
-- The job queue uses 'processing' status to lock jobs, but it wasn't in the allowed values

-- Drop the existing constraint (it might be named differently)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'scheduled_posts'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%check%'
    LIMIT 1;
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE scheduled_posts DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- Add the updated constraint with all required status values
ALTER TABLE scheduled_posts
ADD CONSTRAINT scheduled_posts_approval_status_check 
CHECK (status IN (
  'draft', 
  'pending_approval', 
  'approved', 
  'rejected', 
  'published', 
  'failed',
  'processing',  -- Added for job queue locking
  'cancelled'    -- Added for cancelled posts
));

