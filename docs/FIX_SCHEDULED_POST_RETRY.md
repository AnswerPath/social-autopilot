# Fix: Scheduled Post Keeps Getting Pushed to Later Time

## Problem

Your scheduled post keeps getting automatically rescheduled to a later time because:

1. The job queue tries to set status to `'processing'` to lock the job
2. The database constraint doesn't allow `'processing'` status
3. The update fails with: `"violates check constraint scheduled_posts_approval_status_check"`
4. The retry logic automatically reschedules it with exponential backoff (1 min, 5 min, 30 min)
5. This repeats, pushing the time further and further out

## Solution

Run this SQL migration in your Supabase SQL Editor:

```sql
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
```

## Steps to Fix

1. **Open Supabase Dashboard** → Your Project → SQL Editor

2. **Copy and paste** the SQL above

3. **Run the migration**

4. **Verify it worked**:
   ```bash
   node scripts/check-scheduled-posts.js
   ```

5. **The post should process** on the next scheduler run (within 60 seconds)

## After the Fix

- ✅ Posts will process successfully
- ✅ No more automatic rescheduling due to constraint errors
- ✅ The `'processing'` status will work for job locking
- ✅ Your scheduled post will publish on time

## If the Post is Already on Retry 3/3

If your post has already failed all retries, you can manually reset it:

```sql
-- Reset a failed post to try again
UPDATE scheduled_posts
SET 
  status = 'approved',
  retry_count = 0,
  error = NULL,
  scheduled_at = NOW()  -- Process immediately
WHERE id = 'your-post-id-here';
```

Or use the API to reschedule it through the UI.

