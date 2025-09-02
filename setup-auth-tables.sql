-- Social Autopilot Authentication Tables Setup
-- This script creates all necessary tables for user authentication, profiles, roles, and permissions

-- ========================================
-- 0. Create Helper Functions First
-- ========================================

-- Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================
-- 1. User Profiles Table
-- ========================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    bio TEXT,
    timezone TEXT DEFAULT 'UTC',
    email_notifications BOOLEAN DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO anon;

-- ========================================
-- 2. User Roles Table
-- ========================================

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'VIEWER' 
      CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;

-- Create policies
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Grant permissions
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_roles TO anon;

-- ========================================
-- 3. User Permissions Table
-- ========================================

CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted BOOLEAN DEFAULT true,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, permission)
);

-- Create indexes for user_permissions
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(granted);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON user_permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON user_permissions;

-- Create policies
CREATE POLICY "Users can view their own permissions" ON user_permissions
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all permissions" ON user_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Grant permissions
GRANT ALL ON user_permissions TO authenticated;
GRANT ALL ON user_permissions TO anon;

-- ========================================
-- 4. Account Settings Table
-- ========================================

CREATE TABLE IF NOT EXISTS account_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    notification_preferences JSONB DEFAULT '{
        "email_notifications": true,
        "push_notifications": true,
        "mention_notifications": true,
        "post_approval_notifications": true,
        "analytics_notifications": true,
        "security_notifications": true,
        "marketing_emails": false,
        "weekly_digest": false,
        "daily_summary": false
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

-- Create indexes for account_settings
CREATE INDEX IF NOT EXISTS idx_account_settings_user_id ON account_settings(user_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_account_settings_updated_at ON account_settings;
CREATE TRIGGER update_account_settings_updated_at 
    BEFORE UPDATE ON account_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own settings" ON account_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON account_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON account_settings;

-- Create policies
CREATE POLICY "Users can view their own settings" ON account_settings
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own settings" ON account_settings
    FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own settings" ON account_settings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON account_settings TO authenticated;
GRANT ALL ON account_settings TO anon;

-- ========================================
-- 5. User Sessions Table
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

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON user_sessions;

-- Create policies
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own sessions" ON user_sessions
    FOR DELETE USING (auth.uid()::text = user_id);

-- Grant permissions
GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON user_sessions TO anon;

-- ========================================
-- 6. Audit Logs Table
-- ========================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

-- Create policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Grant permissions
GRANT ALL ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO anon;

-- ========================================
-- 7. Permission Audit Logs Table
-- ========================================

CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT,
    permission TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('granted', 'denied', 'checked')),
    resource_type TEXT,
    resource_id TEXT,
    result BOOLEAN,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for permission_audit_logs
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_permission ON permission_audit_logs(permission);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_action ON permission_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON permission_audit_logs(created_at);

-- Enable RLS
ALTER TABLE permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own permission logs" ON permission_audit_logs;
DROP POLICY IF EXISTS "Admins can view all permission logs" ON permission_audit_logs;

-- Create policies
CREATE POLICY "Users can view their own permission logs" ON permission_audit_logs
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all permission logs" ON permission_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Grant permissions
GRANT ALL ON permission_audit_logs TO authenticated;
GRANT ALL ON permission_audit_logs TO anon;

-- ========================================
-- 8. Create Helper Functions
-- ========================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id_param TEXT)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM user_roles
    WHERE user_id = user_id_param;
    
    RETURN COALESCE(user_role, 'VIEWER');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(user_id_param TEXT, permission_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    has_perm BOOLEAN;
BEGIN
    -- Get user role
    SELECT get_user_role(user_id_param) INTO user_role;
    
    -- Check explicit permissions first
    SELECT granted INTO has_perm
    FROM user_permissions
    WHERE user_id = user_id_param AND permission = permission_param;
    
    -- If explicit permission found, return it
    IF FOUND THEN
        RETURN has_perm;
    END IF;
    
    -- Otherwise, check role-based permissions
    CASE user_role
        WHEN 'ADMIN' THEN
            RETURN true; -- Admins have all permissions
        WHEN 'EDITOR' THEN
            -- Editors have most permissions except user management
            RETURN permission_param NOT IN ('MANAGE_USERS', 'VIEW_ANALYTICS', 'MANAGE_AUTOMATION');
        WHEN 'VIEWER' THEN
            -- Viewers have read-only permissions
            RETURN permission_param IN (
                'VIEW_POSTS', 'VIEW_DASHBOARD', 'VIEW_PROFILE', 
                'VIEW_ACCOUNT_SETTINGS', 'VIEW_NOTIFICATIONS'
            );
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 9. Create Triggers for Automatic Role Assignment
-- ========================================

-- Function to automatically assign default role to new users
CREATE OR REPLACE FUNCTION assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default VIEWER role for new user
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'VIEWER')
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to assign default role when user profile is created
DROP TRIGGER IF EXISTS trigger_assign_default_role ON user_profiles;
CREATE TRIGGER trigger_assign_default_role
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_default_role();

-- ========================================
-- 10. Create Triggers for Session Management
-- ========================================

-- Function to update last_activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session activity
DROP TRIGGER IF EXISTS trigger_update_session_activity ON user_sessions;
CREATE TRIGGER trigger_update_session_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- ========================================
-- 11. Clean up expired sessions (optional)
-- ========================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = false;
END;
$$ LANGUAGE plpgsql;

-- You can call this function periodically or set up a cron job
-- SELECT cleanup_expired_sessions();

-- ========================================
-- Setup Complete!
-- ========================================

-- Verify tables were created
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_profiles',
    'user_roles', 
    'user_permissions',
    'account_settings',
    'user_sessions',
    'audit_logs',
    'permission_audit_logs'
)
ORDER BY table_name;
