-- Seed default approval workflow for demo-user so "Submit for approval" works.
-- The app uses getUserId() => 'demo-user'; without a workflow, ensureWorkflowAssignment fails
-- and the post is created but never appears in the Approvals dashboard.

BEGIN;

-- Insert default workflow for demo-user if none exists
INSERT INTO approval_workflows (owner_id, name, description, scope, is_active, created_by)
SELECT 'demo-user', 'Default Approval Workflow', 'Demo workflow for submit-for-approval', 'global', true, 'demo-user'
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflows
  WHERE owner_id = 'demo-user' AND is_active = true
);

-- Insert one step (Review → manager-user) for that workflow if it has no steps
INSERT INTO approval_workflow_steps (workflow_id, step_order, step_name, approver_type, approver_reference, min_approvals)
SELECT aw.id, 1, 'Review', 'user', 'manager-user', 1
FROM approval_workflows aw
WHERE aw.owner_id = 'demo-user' AND aw.is_active = true
  AND NOT EXISTS (SELECT 1 FROM approval_workflow_steps aws WHERE aws.workflow_id = aw.id)
LIMIT 1;

COMMIT;
