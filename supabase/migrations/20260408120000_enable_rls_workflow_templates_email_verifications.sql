-- Enable RLS on tables that were added without it (Security Advisor: rls_disabled_in_public,
-- sensitive_columns_exposed on email_verifications.token).
-- App access uses service_role (bypasses RLS). anon/authenticated get default deny via PostgREST.

BEGIN;

ALTER TABLE IF EXISTS approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_approval_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS approval_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_verifications ENABLE ROW LEVEL SECURITY;

-- Explicit service_role policies (parity with notifications table; service_role bypasses RLS in practice)

DROP POLICY IF EXISTS "Service role full access" ON approval_workflows;
CREATE POLICY "Service role full access" ON approval_workflows
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON approval_workflow_steps;
CREATE POLICY "Service role full access" ON approval_workflow_steps
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON post_approval_assignments;
CREATE POLICY "Service role full access" ON post_approval_assignments
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON post_revisions;
CREATE POLICY "Service role full access" ON post_revisions
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON approval_notifications;
CREATE POLICY "Service role full access" ON approval_notifications
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON notification_templates;
CREATE POLICY "Service role full access" ON notification_templates
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access" ON email_verifications;
CREATE POLICY "Service role full access" ON email_verifications
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;
