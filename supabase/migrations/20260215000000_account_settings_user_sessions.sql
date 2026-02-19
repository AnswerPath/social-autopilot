-- Account settings and user sessions tables for account-settings API.
-- These were previously only in setup-auth-tables.sql; add them as a migration so DBs created from migrations have them.

-- ========================================
-- Account Settings Table
-- ========================================

CREATE TABLE IF NOT EXISTS account_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    notification_preferences JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "sms_notifications": false,
        "phone_number": null,
        "mention_notifications": true,
        "post_approval_notifications": true,
        "analytics_notifications": true,
        "security_notifications": true,
        "marketing_emails": false,
        "weekly_digest": true,
        "daily_summary": false,
        "digest_frequency": "immediate"
    }',
    security_settings JSONB DEFAULT '{
        "two_factor_enabled": false,
        "login_notifications": true,
        "session_timeout_minutes": 60,
        "require_password_for_sensitive_actions": true,
        "failed_login_attempts": 0
    }',
    account_preferences JSONB DEFAULT '{
        "language": "en",
        "timezone": "UTC",
        "date_format": "MM/DD/YYYY",
        "time_format": "12h",
        "theme": "system",
        "compact_mode": false,
        "auto_save_drafts": true,
        "default_post_visibility": "public"
    }',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_settings_user_id ON account_settings(user_id);

DROP TRIGGER IF EXISTS update_account_settings_updated_at ON account_settings;
CREATE TRIGGER update_account_settings_updated_at
    BEFORE UPDATE ON account_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own settings" ON account_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON account_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON account_settings;

CREATE POLICY "Users can view their own settings" ON account_settings
    FOR SELECT USING ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can update their own settings" ON account_settings
    FOR UPDATE USING ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can insert their own settings" ON account_settings
    FOR INSERT WITH CHECK ((auth.uid())::text = (user_id)::text);

GRANT ALL ON account_settings TO authenticated;
GRANT ALL ON account_settings TO anon;

-- ========================================
-- User Sessions Table
-- ========================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON user_sessions;

CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can delete their own sessions" ON user_sessions
    FOR DELETE USING ((auth.uid())::text = (user_id)::text);

GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON user_sessions TO anon;
