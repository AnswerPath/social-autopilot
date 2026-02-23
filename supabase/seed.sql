-- Development-only seed: demo approval workflow for demo-user / manager-user.
-- Do not run in production. Ensure CI/CD does not run `supabase db seed` in non-dev pipelines.

DO $$
BEGIN
  IF COALESCE(current_setting('app.environment', true), '') IS DISTINCT FROM 'development' THEN
    RAISE EXCEPTION 'Seed is only allowed when app.environment = development. Current: %', COALESCE(current_setting('app.environment', true), '(not set)');
  END IF;
END
$$;

BEGIN;

INSERT INTO approval_workflows (owner_id, name, description, scope, is_active, created_by)
SELECT 'demo-user', 'Default Approval Workflow', 'Demo workflow for submit-for-approval', 'global', true, 'demo-user'
WHERE NOT EXISTS (
  SELECT 1 FROM approval_workflows
  WHERE owner_id = 'demo-user' AND is_active = true
);

WITH selected_workflow AS (
  SELECT id FROM approval_workflows
  WHERE owner_id = 'demo-user' AND is_active = true
  AND NOT EXISTS (SELECT 1 FROM approval_workflow_steps aws WHERE aws.workflow_id = approval_workflows.id)
  ORDER BY created_at ASC
  LIMIT 1
)
INSERT INTO approval_workflow_steps (workflow_id, step_order, step_name, approver_type, approver_reference, min_approvals)
SELECT id, 1, 'Review', 'user', 'manager-user', 1
FROM selected_workflow;

COMMIT;
