-- Migration: Approval Workflow Enhancements
-- Date: 2025-11-15
-- Description: Adds multi-step workflow support, threaded comments, revision tracking, and notification queues.

BEGIN;

-- ========================================
-- 1. Core workflow metadata
-- ========================================

CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT DEFAULT 'global' CHECK (scope IN ('global', 'team', 'department', 'content_type')),
    scope_filters JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_owner ON approval_workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_active ON approval_workflows(is_active);

CREATE TRIGGER trigger_update_approval_workflows
    BEFORE UPDATE ON approval_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 2. Workflow steps
-- ========================================

CREATE TABLE IF NOT EXISTS approval_workflow_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    approver_type TEXT NOT NULL CHECK (approver_type IN ('user', 'role', 'team')),
    approver_reference TEXT NOT NULL,
    min_approvals INTEGER DEFAULT 1,
    auto_escalate_after_hours INTEGER,
    is_optional BOOLEAN DEFAULT false,
    sla_hours INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON approval_workflow_steps(workflow_id);

CREATE TRIGGER trigger_update_approval_workflow_steps
    BEFORE UPDATE ON approval_workflow_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 3. Post assignments and tracking
-- ========================================

ALTER TABLE scheduled_posts
    ADD COLUMN IF NOT EXISTS approval_workflow_id UUID REFERENCES approval_workflows(id),
    ADD COLUMN IF NOT EXISTS current_step_order INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approval_dashboard_metadata JSONB;

CREATE TABLE IF NOT EXISTS post_approval_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    current_step_id UUID REFERENCES approval_workflow_steps(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'in_review', 'approved', 'rejected', 'changes_requested')),
    step_history JSONB DEFAULT '[]'::jsonb,
    next_due_at TIMESTAMPTZ,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_approval_assignments_status ON post_approval_assignments(status);
CREATE INDEX IF NOT EXISTS idx_post_approval_assignments_workflow ON post_approval_assignments(workflow_id);

CREATE TRIGGER trigger_update_post_approval_assignments
    BEFORE UPDATE ON post_approval_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 4. Threaded comments & workflow linkage
-- ========================================

ALTER TABLE approval_comments
    ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES approval_comments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS thread_id UUID,
    ADD COLUMN IF NOT EXISTS mentions TEXT[],
    ADD COLUMN IF NOT EXISTS workflow_step_id UUID REFERENCES approval_workflow_steps(id),
    ADD COLUMN IF NOT EXISTS resolved_comment TEXT;

UPDATE approval_comments
SET thread_id = COALESCE(thread_id, id)
WHERE thread_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_comments_thread ON approval_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_approval_comments_step ON approval_comments(workflow_step_id);

ALTER TABLE approval_history
    ADD COLUMN IF NOT EXISTS workflow_step_id UUID REFERENCES approval_workflow_steps(id);

-- ========================================
-- 5. Revision history
-- ========================================

CREATE TABLE IF NOT EXISTS post_revisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    diff JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_reason TEXT,
    UNIQUE(post_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_post_revisions_post ON post_revisions(post_id);

-- ========================================
-- 6. Notification queue
-- ========================================

CREATE TABLE IF NOT EXISTS approval_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES scheduled_posts(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
    notification_type TEXT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_notifications_recipient ON approval_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_status ON approval_notifications(status);

-- ========================================
-- 7. Dashboard view for managers
-- ========================================

CREATE OR REPLACE VIEW approval_dashboard_summary AS
SELECT 
    sp.id AS post_id,
    sp.user_id,
    sp.status,
    sp.scheduled_at,
    sp.submitted_for_approval_at,
    sp.requires_approval,
    paa.workflow_id,
    paa.current_step_id,
    paa.status AS assignment_status,
    aws.step_name,
    aws.step_order,
    (SELECT COUNT(*) FROM approval_comments ac WHERE ac.post_id = sp.id AND ac.is_resolved = false) AS open_comments,
    (SELECT COUNT(*) FROM approval_comments ac WHERE ac.post_id = sp.id) AS total_comments
FROM scheduled_posts sp
LEFT JOIN post_approval_assignments paa ON paa.post_id = sp.id
LEFT JOIN approval_workflow_steps aws ON aws.id = paa.current_step_id;

GRANT SELECT ON approval_dashboard_summary TO authenticated;
GRANT SELECT ON approval_dashboard_summary TO anon;

COMMIT;

