-- Migration: Add Approval Workflow to Database Schema
-- Date: 2025-08-27
-- Description: Implements approval workflow for scheduled posts with status tracking, comments, and approval history

-- ========================================
-- 1. Update scheduled_posts table for approval workflow
-- ========================================

-- Add approval-related columns to scheduled_posts
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'draft' 
  CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'published', 'failed')),
ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES scheduled_posts(id),
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Update existing status values to map to new approval_status
UPDATE scheduled_posts 
SET approval_status = CASE 
  WHEN status = 'scheduled' THEN 'approved'
  WHEN status = 'pending_approval' THEN 'pending_approval'
  WHEN status = 'published' THEN 'published'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'draft'
END,
requires_approval = CASE 
  WHEN status = 'pending_approval' THEN true
  ELSE false
END;

-- Drop the old status column and rename approval_status to status
ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS status;
ALTER TABLE scheduled_posts RENAME COLUMN approval_status TO status;

-- Create indexes for approval workflow queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_approval_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_requires_approval ON scheduled_posts(requires_approval);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_submitted_at ON scheduled_posts(submitted_for_approval_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_approved_by ON scheduled_posts(approved_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_parent_id ON scheduled_posts(parent_post_id);

-- ========================================
-- 2. Create approval_comments table
-- ========================================

CREATE TABLE IF NOT EXISTS approval_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    comment TEXT NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'feedback' 
      CHECK (comment_type IN ('feedback', 'approval', 'rejection', 'revision_request')),
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for approval_comments
CREATE INDEX IF NOT EXISTS idx_approval_comments_post_id ON approval_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_approval_comments_user_id ON approval_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_comments_type ON approval_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_approval_comments_resolved ON approval_comments(is_resolved);

-- Add updated_at trigger
CREATE TRIGGER update_approval_comments_updated_at 
    BEFORE UPDATE ON approval_comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE approval_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for demo (approval_comments)" ON approval_comments
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON approval_comments TO authenticated;
GRANT ALL ON approval_comments TO anon;

-- ========================================
-- 3. Create approval_workflow_rules table
-- ========================================

CREATE TABLE IF NOT EXISTS approval_workflow_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL DEFAULT 'content_approval' 
      CHECK (rule_type IN ('content_approval', 'time_approval', 'media_approval', 'keyword_approval')),
    is_active BOOLEAN DEFAULT true,
    conditions JSONB NOT NULL, -- Flexible conditions (e.g., content length, keywords, media presence)
    requires_approval BOOLEAN DEFAULT true,
    approver_user_ids TEXT[], -- Array of user IDs who can approve
    auto_approve_after_hours INTEGER, -- Auto-approve if no response within X hours
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, rule_name)
);

-- Create indexes for approval_workflow_rules
CREATE INDEX IF NOT EXISTS idx_approval_workflow_rules_user_id ON approval_workflow_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_rules_type ON approval_workflow_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_approval_workflow_rules_active ON approval_workflow_rules(is_active);

-- Add updated_at trigger
CREATE TRIGGER update_approval_workflow_rules_updated_at 
    BEFORE UPDATE ON approval_workflow_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE approval_workflow_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for demo (approval_workflow_rules)" ON approval_workflow_rules
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON approval_workflow_rules TO authenticated;
GRANT ALL ON approval_workflow_rules TO anon;

-- ========================================
-- 4. Create approval_history table for audit trail
-- ========================================

CREATE TABLE IF NOT EXISTS approval_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    action TEXT NOT NULL 
      CHECK (action IN ('submitted', 'approved', 'rejected', 'revision_requested', 'auto_approved', 'published')),
    user_id TEXT NOT NULL,
    action_details JSONB, -- Flexible storage for action-specific data
    previous_status TEXT,
    new_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for approval_history
CREATE INDEX IF NOT EXISTS idx_approval_history_post_id ON approval_history(post_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_action ON approval_history(action);
CREATE INDEX IF NOT EXISTS idx_approval_history_user_id ON approval_history(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_created_at ON approval_history(created_at);

-- Enable RLS
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for demo (approval_history)" ON approval_history
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON approval_history TO authenticated;
GRANT ALL ON approval_history TO anon;

-- ========================================
-- 5. Create function to handle approval workflow transitions
-- ========================================

CREATE OR REPLACE FUNCTION handle_approval_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into approval_history when status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
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
                ELSE 'status_changed'
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

-- Create trigger for approval status changes
DROP TRIGGER IF EXISTS trigger_approval_status_change ON scheduled_posts;
CREATE TRIGGER trigger_approval_status_change
    BEFORE UPDATE ON scheduled_posts
    FOR EACH ROW
    EXECUTE FUNCTION handle_approval_status_change();

-- ========================================
-- 6. Create function to check if approval is required
-- ========================================

CREATE OR REPLACE FUNCTION check_approval_required(
    p_user_id TEXT,
    p_content TEXT,
    p_media_urls TEXT[],
    p_scheduled_at TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
    rule_record RECORD;
    requires_approval BOOLEAN := false;
BEGIN
    -- Check active approval rules for the user
    FOR rule_record IN 
        SELECT * FROM approval_workflow_rules 
        WHERE user_id = p_user_id AND is_active = true
    LOOP
        -- Simple rule evaluation (can be enhanced with more complex logic)
        IF rule_record.rule_type = 'content_approval' THEN
            -- Check content length
            IF rule_record.conditions->>'max_length' IS NOT NULL THEN
                IF length(p_content) > (rule_record.conditions->>'max_length')::integer THEN
                    requires_approval := true;
                END IF;
            END IF;
            
            -- Check for keywords that require approval
            IF rule_record.conditions->>'keywords' IS NOT NULL THEN
                IF p_content ~* ANY(ARRAY(SELECT jsonb_array_elements_text(rule_record.conditions->'keywords'))) THEN
                    requires_approval := true;
                END IF;
            END IF;
        END IF;
        
        IF rule_record.rule_type = 'media_approval' THEN
            -- Check if media is present
            IF rule_record.conditions->>'require_approval_with_media' = 'true' AND array_length(p_media_urls, 1) > 0 THEN
                requires_approval := true;
            END IF;
        END IF;
        
        IF rule_record.rule_type = 'time_approval' THEN
            -- Check if scheduled time is outside business hours
            IF rule_record.conditions->>'business_hours_only' = 'true' THEN
                IF EXTRACT(HOUR FROM p_scheduled_at) < 9 OR EXTRACT(HOUR FROM p_scheduled_at) > 17 THEN
                    requires_approval := true;
                END IF;
            END IF;
        END IF;
        
        -- If any rule requires approval, set the flag
        IF rule_record.requires_approval THEN
            requires_approval := true;
        END IF;
    END LOOP;
    
    RETURN requires_approval;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. Insert default approval rules for demo user
-- ========================================

INSERT INTO approval_workflow_rules (
    user_id, 
    rule_name, 
    rule_type, 
    conditions, 
    requires_approval, 
    approver_user_ids
) VALUES 
(
    'demo-user',
    'Content Length Approval',
    'content_approval',
    '{"max_length": 200, "keywords": ["sale", "discount", "limited time"]}',
    true,
    ARRAY['admin-user', 'manager-user']
),
(
    'demo-user',
    'Content Length Approval',
    'media_approval',
    '{"require_approval_with_media": true}',
    true,
    ARRAY['admin-user']
),
(
    'demo-user',
    'Business Hours Approval',
    'time_approval',
    '{"business_hours_only": true}',
    false,
    ARRAY['admin-user']
)
ON CONFLICT (user_id, rule_name) DO NOTHING;

-- ========================================
-- 8. Update existing posts to have proper approval status
-- ========================================

-- Set requires_approval based on content analysis
UPDATE scheduled_posts 
SET requires_approval = check_approval_required(user_id, content, media_urls, scheduled_at)
WHERE requires_approval IS NULL;

-- ========================================
-- 9. Create views for common approval queries
-- ========================================

-- View for posts pending approval
CREATE OR REPLACE VIEW posts_pending_approval AS
SELECT 
    sp.*,
    ac.comment_count,
    ac.latest_comment_at
FROM scheduled_posts sp
LEFT JOIN (
    SELECT 
        post_id,
        COUNT(*) as comment_count,
        MAX(created_at) as latest_comment_at
    FROM approval_comments 
    GROUP BY post_id
    ) ac ON sp.id = ac.post_id
WHERE sp.status = 'pending_approval'
ORDER BY sp.submitted_for_approval_at ASC;

-- View for approval statistics
CREATE OR REPLACE VIEW approval_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
    COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_count,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE status = 'published') as published_count,
    AVG(EXTRACT(EPOCH FROM (approved_at - submitted_for_approval_at))/3600) as avg_approval_hours
FROM scheduled_posts 
GROUP BY user_id;

-- ========================================
-- 10. Grant permissions on views
-- ========================================

GRANT SELECT ON posts_pending_approval TO authenticated;
GRANT SELECT ON posts_pending_approval TO anon;
GRANT SELECT ON approval_statistics TO authenticated;
GRANT SELECT ON approval_statistics TO anon;

-- ========================================
-- Migration complete
-- ========================================

-- Verify the new schema
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('scheduled_posts', 'approval_comments', 'approval_workflow_rules', 'approval_history')
ORDER BY table_name, ordinal_position;
