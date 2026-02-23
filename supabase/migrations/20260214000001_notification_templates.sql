-- Migration: Notification Templates (Task 24.4)
-- Description: Table for notification templates with variable substitution and locale support.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN ('approval', 'mention', 'analytics', 'system')),
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
    locale TEXT NOT NULL DEFAULT 'en',
    subject TEXT,
    body_template TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_type, notification_type, channel, locale)
);

-- UNIQUE constraint above already creates an index; no separate index needed.

CREATE TRIGGER trigger_update_notification_templates
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Default templates for approval events
INSERT INTO notification_templates (event_type, notification_type, channel, locale, subject, body_template) VALUES
('approval', 'approval_step_ready', 'in_app', 'en', NULL, 'Post needs your approval at step {{stepName}}.'),
('approval', 'approval_step_ready', 'email', 'en', 'Approval needed: {{stepName}}', 'A post is waiting for your approval at step {{stepName}}.'),
('approval', 'approval_step_ready', 'sms', 'en', NULL, 'Approval needed: {{stepName}}'),
('approval', 'approval_approved', 'in_app', 'en', NULL, 'Post was approved.'),
('approval', 'approval_rejected', 'in_app', 'en', NULL, 'Post was rejected.'),
('approval', 'approval_changes_requested', 'in_app', 'en', NULL, 'Changes requested on post.')
ON CONFLICT (event_type, notification_type, channel, locale) DO NOTHING;

-- Placeholder templates for mention and analytics
INSERT INTO notification_templates (event_type, notification_type, channel, locale, subject, body_template) VALUES
('mention', 'new_mention', 'in_app', 'en', NULL, 'You were mentioned by {{userName}}.'),
('mention', 'new_mention', 'email', 'en', 'New mention from {{userName}}', 'You were mentioned: {{content}}.'),
('analytics', 'daily_summary', 'in_app', 'en', NULL, 'Your daily analytics summary is ready.'),
('analytics', 'daily_summary', 'email', 'en', 'Daily analytics summary', 'Here is your daily summary: {{summary}}.'),
('analytics', 'weekly_digest', 'email', 'en', 'Weekly digest', 'Your weekly activity digest: {{summary}}.')
ON CONFLICT (event_type, notification_type, channel, locale) DO NOTHING;

COMMIT;
