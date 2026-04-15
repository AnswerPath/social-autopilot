-- Seed additional SMS notification templates (Twilio transactional SMS)

BEGIN;

INSERT INTO notification_templates (event_type, notification_type, channel, locale, subject, body_template) VALUES
('approval', 'approval_approved', 'sms', 'en', NULL, 'Your post has been approved.'),
('approval', 'approval_rejected', 'sms', 'en', NULL, 'Your post was rejected.'),
('approval', 'approval_changes_requested', 'sms', 'en', NULL, 'Changes requested on your post.'),
('mention', 'new_mention', 'sms', 'en', NULL, 'You were mentioned by {{userName}}.'),
('system', 'test_notification', 'sms', 'en', NULL, 'Test notification from Social Autopilot.')
ON CONFLICT (event_type, notification_type, channel, locale) DO NOTHING;

COMMIT;
