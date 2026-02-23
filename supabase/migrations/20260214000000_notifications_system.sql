-- Migration: Unified Notifications System (Task 24)
-- Description: Adds generic notifications table with event_type and priority for approvals, mentions, analytics.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'sms')),
    event_type TEXT NOT NULL DEFAULT 'approval' CHECK (event_type IN ('approval', 'mention', 'analytics', 'system')),
    notification_type TEXT NOT NULL,
    payload JSONB,
    post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error TEXT,
    digest_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(recipient_id, created_at DESC);

-- RLS: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid()::text = recipient_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid()::text = recipient_id);

-- Service role can do everything (for queueing, cron, etc.)
DROP POLICY IF EXISTS "Service role full access" ON notifications;
CREATE POLICY "Service role full access" ON notifications
    FOR ALL USING (auth.role() = 'service_role');

COMMIT;
