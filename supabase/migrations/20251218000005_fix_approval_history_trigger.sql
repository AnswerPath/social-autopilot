-- Fix approval_history trigger to handle 'processing' status correctly
-- The trigger was trying to insert 'status_changed' which violates the check constraint
-- We should skip approval_history entries for internal queue statuses like 'processing'

CREATE OR REPLACE FUNCTION handle_approval_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert into approval_history for approval-related status changes
    -- Skip internal queue statuses like 'processing', 'failed', etc.
    IF OLD.status IS DISTINCT FROM NEW.status 
       AND NEW.status IN ('pending_approval', 'approved', 'rejected', 'published')
    THEN
        INSERT INTO approval_history (
            post_id, 
            action, 
            user_id, 
            previous_status, 
            new_status,
            action_details
        ) VALUES (
            NEW.id,
            CASE 
                WHEN NEW.status = 'pending_approval' THEN 'submitted'
                WHEN NEW.status = 'approved' THEN 'approved'
                WHEN NEW.status = 'rejected' THEN 'rejected'
                WHEN NEW.status = 'published' THEN 'published'
                -- This should never happen due to the IF condition above, but included for safety
                ELSE 'submitted'
            END,
            COALESCE(NEW.approved_by, NEW.rejected_by, 'system'),
            OLD.status,
            NEW.status,
            CASE 
                WHEN NEW.status = 'rejected' THEN jsonb_build_object('rejection_reason', NEW.rejection_reason)
                ELSE NULL
            END
        );
    END IF;
    
    -- Update timestamps based on status changes
    IF NEW.status = 'pending_approval' AND OLD.status != 'pending_approval' THEN
        NEW.submitted_for_approval_at = NOW();
    END IF;
    
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        NEW.approved_at = NOW();
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        NEW.rejected_at = NOW();
    END IF;
    
    -- Increment revision count when creating a revision
    IF NEW.parent_post_id IS NOT NULL AND OLD.parent_post_id IS NULL THEN
        NEW.revision_count = 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

