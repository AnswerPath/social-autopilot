-- =============================================================================
-- Consolidated migration for Social Autopilot
-- Run this single migration once on a fresh Supabase project to get the full
-- schema. Do NOT run it if you have already applied individual migrations.
-- Requires: Supabase Auth enabled (auth.users). Seed data: run supabase/seed.sql
-- separately in dev if needed.
-- =============================================================================

-- =============================================================================
-- Part 1: Base schema (tables referenced by migrations but not created in them)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================
-- User Profiles Table
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
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO anon;

-- ========================================
-- User Roles Table
-- ========================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'VIEWER' 
      CHECK (role IN ('ADMIN', 'EDITOR', 'VIEWER')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_roles TO anon;

-- ========================================
-- User Permissions Table
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
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted ON user_permissions(granted);
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at 
    BEFORE UPDATE ON user_permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON user_permissions;
CREATE POLICY "Users can view their own permissions" ON user_permissions
    FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Admins can view all permissions" ON user_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );
GRANT ALL ON user_permissions TO authenticated;
GRANT ALL ON user_permissions TO anon;

-- Assign default role when user profile is created
CREATE OR REPLACE FUNCTION assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_roles (user_id, role)
    VALUES (NEW.user_id, 'VIEWER')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trigger_assign_default_role ON user_profiles;
CREATE TRIGGER trigger_assign_default_role
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION assign_default_role();

-- ========================================
-- Scheduled posts (base table)
-- ========================================
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT[],
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    posted_tweet_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_time ON scheduled_posts(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
DROP TRIGGER IF EXISTS update_scheduled_posts_updated_at ON scheduled_posts;
CREATE TRIGGER update_scheduled_posts_updated_at 
    BEFORE UPDATE ON scheduled_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for demo (scheduled_posts)" ON scheduled_posts;
CREATE POLICY "Allow all operations for demo (scheduled_posts)" ON scheduled_posts
    FOR ALL USING (true);
GRANT ALL ON scheduled_posts TO authenticated;
GRANT ALL ON scheduled_posts TO anon;

-- =============================================================================
-- Part 2: Migrations (in order)
-- =============================================================================

-- --- 20240101000000_initial_setup.sql ---
-- Create the credentials table with proper security
CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_type TEXT NOT NULL DEFAULT 'twitter',
    encrypted_api_key TEXT NOT NULL,
    encrypted_api_secret TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_access_secret TEXT NOT NULL,
    encrypted_bearer_token TEXT,
    encryption_version INTEGER DEFAULT 1,
    is_valid BOOLEAN DEFAULT FALSE,
    last_validated TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, credential_type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_type ON user_credentials(credential_type);
CREATE INDEX IF NOT EXISTS idx_user_credentials_valid ON user_credentials(is_valid);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_credentials_updated_at ON user_credentials;
CREATE TRIGGER update_user_credentials_updated_at 
    BEFORE UPDATE ON user_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can only access their own credentials" ON user_credentials;
DROP POLICY IF EXISTS "Allow all operations for demo" ON user_credentials;

-- Create policy to allow all operations for demo (in production, use proper auth)
CREATE POLICY "Allow all operations for demo" ON user_credentials
    FOR ALL USING (true);

-- Grant necessary permissions
GRANT ALL ON user_credentials TO authenticated;
GRANT ALL ON user_credentials TO anon;
-- --- 20250102000000_granular_permissions.sql ---
-- Migration: Granular Permission System
-- Description: Create tables for resource-based permissions, custom permissions, and permission overrides

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Permissions Table
-- Stores custom permission sets that can be assigned to users
CREATE TABLE IF NOT EXISTS custom_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions TEXT[] NOT NULL, -- Array of permission strings
    resource_types TEXT[], -- Optional resource types this applies to
    conditions JSONB, -- JSON array of permission conditions
    is_system BOOLEAN DEFAULT FALSE, -- System-defined vs user-defined
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique names
    UNIQUE(name)
);

-- User Custom Permissions Junction Table
-- Links users to custom permissions
CREATE TABLE IF NOT EXISTS user_custom_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    custom_permission_id UUID NOT NULL REFERENCES custom_permissions(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique user-permission combinations
    UNIQUE(user_id, custom_permission_id)
);

-- Resource Permissions Table
-- Stores permissions for specific resources (e.g., edit_post:123)
CREATE TABLE IF NOT EXISTS resource_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL, -- The permission string
    resource_type VARCHAR(100) NOT NULL, -- Type of resource (post, media, team, etc.)
    resource_id VARCHAR(255) NOT NULL, -- ID of the specific resource
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    conditions JSONB, -- JSON array of permission conditions
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure unique user-permission-resource combinations
    UNIQUE(user_id, permission, resource_type, resource_id)
);

-- Permission Overrides Table
-- Stores explicit permission grants or denials that override role-based permissions
CREATE TABLE IF NOT EXISTS permission_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(255) NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('grant', 'deny')),
    resource_type VARCHAR(100), -- Optional: specific resource type
    resource_id VARCHAR(255), -- Optional: specific resource ID
    reason TEXT NOT NULL, -- Reason for the override
    granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Partial unique constraint for active overrides only (NULLs normalized via COALESCE so uniqueness is enforced)
CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_overrides_unique_active
ON permission_overrides (
  user_id,
  permission,
  COALESCE(resource_type, '__NULL__'),
  COALESCE(resource_id, '__NULL__')
)
WHERE is_active = TRUE;

-- Permission Audit Log Table
-- Tracks all permission checks and changes for audit purposes
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- PERMISSION_CHECKED, PERMISSION_GRANTED, etc.
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    permission VARCHAR(255),
    allowed BOOLEAN,
    source VARCHAR(50), -- role, custom, resource, override, etc.
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_custom_permissions_name ON custom_permissions(name);
CREATE INDEX IF NOT EXISTS idx_custom_permissions_created_by ON custom_permissions(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_permissions_created_at ON custom_permissions(created_at);

CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_user_id ON user_custom_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_permission_id ON user_custom_permissions(custom_permission_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_active ON user_custom_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_expires ON user_custom_permissions(expires_at);

CREATE INDEX IF NOT EXISTS idx_resource_permissions_user_id ON resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_permission ON resource_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_resource ON resource_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_active ON resource_permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_expires ON resource_permissions(expires_at);

CREATE INDEX IF NOT EXISTS idx_permission_overrides_user_id ON permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_permission ON permission_overrides(permission);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_action ON permission_overrides(action);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_active ON permission_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_permission_overrides_expires ON permission_overrides(expires_at);

CREATE INDEX IF NOT EXISTS idx_permission_audit_user_id ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_action ON permission_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_permission ON permission_audit_log(permission);
CREATE INDEX IF NOT EXISTS idx_permission_audit_created_at ON permission_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_permission_audit_resource ON permission_audit_log(resource_type, resource_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_custom_permissions_updated_at 
    BEFORE UPDATE ON custom_permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE custom_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Custom Permissions Policies
CREATE POLICY "Users can view custom permissions they created" ON custom_permissions
    FOR SELECT USING (auth.uid()::text = created_by::text);

CREATE POLICY "Admins can view all custom permissions" ON custom_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can create custom permissions" ON custom_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Users can update custom permissions they created" ON custom_permissions
    FOR UPDATE USING (auth.uid()::text = created_by::text);

CREATE POLICY "Admins can update all custom permissions" ON custom_permissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- User Custom Permissions Policies
CREATE POLICY "Users can view their own custom permissions" ON user_custom_permissions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all user custom permissions" ON user_custom_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage user custom permissions" ON user_custom_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Resource Permissions Policies
CREATE POLICY "Users can view their own resource permissions" ON resource_permissions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all resource permissions" ON resource_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage resource permissions" ON resource_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Permission Overrides Policies
CREATE POLICY "Users can view their own permission overrides" ON permission_overrides
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all permission overrides" ON permission_overrides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage permission overrides" ON permission_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Permission Audit Log Policies
CREATE POLICY "Users can view their own permission audit logs" ON permission_audit_log
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all permission audit logs" ON permission_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can insert permission audit logs" ON permission_audit_log
    FOR INSERT WITH CHECK (true); -- Allow all inserts for audit logging

-- Create some default custom permissions
INSERT INTO custom_permissions (name, description, permissions, resource_types, is_system, created_by)
VALUES 
    (
        'Content Manager',
        'Can manage all content including posts and media',
        ARRAY['create_post', 'edit_post', 'delete_post', 'upload_media', 'edit_media', 'delete_media'],
        ARRAY['post', 'media'],
        true,
        (SELECT id FROM auth.users LIMIT 1) -- Will be updated by admin
    ),
    (
        'Analytics Viewer',
        'Can view all analytics and export data',
        ARRAY['view_analytics', 'export_data', 'view_engagement_metrics', 'view_performance_reports'],
        NULL,
        true,
        (SELECT id FROM auth.users LIMIT 1) -- Will be updated by admin
    ),
    (
        'Team Lead',
        'Can manage team members and assignments',
        ARRAY['invite_members', 'remove_members', 'assign_to_teams', 'view_team_members'],
        ARRAY['team'],
        true,
        (SELECT id FROM auth.users LIMIT 1) -- Will be updated by admin
    )
ON CONFLICT (name) DO NOTHING;

-- Create a function to clean up expired permissions
CREATE OR REPLACE FUNCTION cleanup_expired_permissions()
RETURNS void AS $$
BEGIN
    -- Deactivate expired resource permissions
    UPDATE resource_permissions 
    SET is_active = FALSE 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND is_active = TRUE;
    
    -- Deactivate expired permission overrides
    UPDATE permission_overrides 
    SET is_active = FALSE 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND is_active = TRUE;
    
    -- Deactivate expired user custom permissions
    UPDATE user_custom_permissions 
    SET is_active = FALSE 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get user's effective permissions
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
    p_user_id UUID,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    permission VARCHAR,
    source VARCHAR,
    granted_by UUID,
    granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Role-based permissions
    RETURN QUERY
    SELECT 
        unnest(ur.permissions) as permission,
        'role' as source,
        ur.user_id as granted_by,
        ur.created_at as granted_at,
        NULL::TIMESTAMP WITH TIME ZONE as expires_at
    FROM user_roles ur
    WHERE ur.user_id = p_user_id::text
    AND ur.role IN ('ADMIN', 'EDITOR', 'VIEWER');
    
    -- Custom permissions
    RETURN QUERY
    SELECT 
        unnest(cp.permissions) as permission,
        'custom' as source,
        ucp.granted_by,
        ucp.granted_at,
        ucp.expires_at
    FROM user_custom_permissions ucp
    JOIN custom_permissions cp ON ucp.custom_permission_id = cp.id
    WHERE ucp.user_id = p_user_id
    AND ucp.is_active = TRUE
    AND (ucp.expires_at IS NULL OR ucp.expires_at > NOW());
    
    -- Resource permissions
    RETURN QUERY
    SELECT 
        rp.permission,
        'resource' as source,
        rp.granted_by,
        rp.granted_at,
        rp.expires_at
    FROM resource_permissions rp
    WHERE rp.user_id = p_user_id
    AND rp.is_active = TRUE
    AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
    AND (p_resource_type IS NULL OR rp.resource_type = p_resource_type)
    AND (p_resource_id IS NULL OR rp.resource_id = p_resource_id);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_custom_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON resource_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON permission_overrides TO authenticated;
GRANT SELECT, INSERT ON permission_audit_log TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_effective_permissions(UUID, VARCHAR, VARCHAR) TO authenticated;

-- --- 20250102000001_activity_logging_enhancement.sql ---
-- Migration: Enhanced Activity Logging System
-- Description: Create enhanced activity logging tables with categories, levels, and retention policies

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enhanced Activity Logs Table
-- Replaces the basic audit_logs table with enhanced features
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'authentication', 'authorization', 'user_management', 'content_management',
        'system_administration', 'security', 'data_access', 'api_usage',
        'permission_changes', 'session_management'
    )),
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    severity_score INTEGER NOT NULL DEFAULT 1 CHECK (severity_score BETWEEN 1 AND 10),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    details JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    retention_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Log Statistics Table (for caching aggregated data)
CREATE TABLE IF NOT EXISTS activity_log_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, category, level)
);

-- Activity Log Retention Policies Table
CREATE TABLE IF NOT EXISTS activity_log_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    retention_days INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(category, level)
);

-- Activity Log Exports Table (track export requests for audit)
CREATE TABLE IF NOT EXISTS activity_log_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    export_type VARCHAR(20) NOT NULL CHECK (export_type IN ('json', 'csv')),
    filters JSONB,
    record_count INTEGER,
    file_size_bytes BIGINT,
    download_url VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE,
    downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_level ON activity_logs(level);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON activity_logs(severity_score);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_retention ON activity_logs(retention_until);
CREATE INDEX IF NOT EXISTS idx_activity_logs_composite ON activity_logs(user_id, category, level, created_at);

-- Create indexes for activity_log_stats
CREATE INDEX IF NOT EXISTS idx_activity_log_stats_date ON activity_log_stats(date);
CREATE INDEX IF NOT EXISTS idx_activity_log_stats_category ON activity_log_stats(category);
CREATE INDEX IF NOT EXISTS idx_activity_log_stats_level ON activity_log_stats(level);

-- Create indexes for activity_log_exports
CREATE INDEX IF NOT EXISTS idx_activity_log_exports_user_id ON activity_log_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_exports_created_at ON activity_log_exports(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_exports_expires_at ON activity_log_exports(expires_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_activity_log_stats_updated_at 
    BEFORE UPDATE ON activity_log_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_activity_log_retention_policies_updated_at 
    BEFORE UPDATE ON activity_log_retention_policies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log_exports ENABLE ROW LEVEL SECURITY;

-- Activity Logs Policies
CREATE POLICY "Users can view their own activity logs" ON activity_logs
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all activity logs" ON activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can insert activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true); -- Allow all inserts for logging

CREATE POLICY "Admins can manage activity logs" ON activity_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Activity Log Stats Policies
CREATE POLICY "Admins can view activity log stats" ON activity_log_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can manage activity log stats" ON activity_log_stats
    FOR ALL WITH CHECK (true); -- Allow system operations

-- Activity Log Retention Policies
CREATE POLICY "Admins can view retention policies" ON activity_log_retention_policies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage retention policies" ON activity_log_retention_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

-- Activity Log Exports Policies
CREATE POLICY "Users can view their own exports" ON activity_log_exports
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all exports" ON activity_log_exports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid()::text AND role = 'ADMIN'
        )
    );

CREATE POLICY "Users can create exports" ON activity_log_exports
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Create functions for activity logging

-- Function to clean up expired logs
CREATE OR REPLACE FUNCTION cleanup_expired_activity_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired logs
    DELETE FROM activity_logs 
    WHERE retention_until IS NOT NULL 
    AND retention_until < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old exports
    DELETE FROM activity_log_exports 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update activity log statistics
CREATE OR REPLACE FUNCTION update_activity_log_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
    -- Delete existing stats for the date
    DELETE FROM activity_log_stats WHERE date = target_date;
    
    -- Insert new stats
    INSERT INTO activity_log_stats (date, category, level, event_count, unique_users)
    SELECT 
        target_date,
        category,
        level,
        COUNT(*) as event_count,
        COUNT(DISTINCT user_id) as unique_users
    FROM activity_logs
    WHERE DATE(created_at) = target_date
    GROUP BY category, level;
END;
$$ LANGUAGE plpgsql;

-- Function to get activity log summary
CREATE OR REPLACE FUNCTION get_activity_log_summary(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    category VARCHAR(50),
    level VARCHAR(20),
    event_count BIGINT,
    unique_users BIGINT,
    avg_severity NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.category,
        al.level,
        COUNT(*) as event_count,
        COUNT(DISTINCT al.user_id) as unique_users,
        ROUND(AVG(al.severity_score), 2) as avg_severity
    FROM activity_logs al
    WHERE DATE(al.created_at) BETWEEN start_date AND end_date
    GROUP BY al.category, al.level
    ORDER BY al.category, al.level;
END;
$$ LANGUAGE plpgsql;

-- Function to search activity logs
CREATE OR REPLACE FUNCTION search_activity_logs(
    search_query TEXT,
    user_filter UUID DEFAULT NULL,
    category_filter VARCHAR(50) DEFAULT NULL,
    level_filter VARCHAR(20) DEFAULT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    min_severity INTEGER DEFAULT 1,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    action VARCHAR(255),
    level VARCHAR(20),
    category VARCHAR(50),
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    severity_score INTEGER,
    session_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.user_id,
        al.action,
        al.level,
        al.category,
        al.resource_type,
        al.resource_id,
        al.severity_score,
        al.session_id,
        al.details,
        al.ip_address,
        al.created_at
    FROM activity_logs al
    WHERE 
        (search_query IS NULL OR 
         al.action ILIKE '%' || search_query || '%' OR
         al.details::text ILIKE '%' || search_query || '%')
    AND (user_filter IS NULL OR al.user_id = user_filter)
    AND (category_filter IS NULL OR al.category = category_filter)
    AND (level_filter IS NULL OR al.level = level_filter)
    AND (start_date IS NULL OR al.created_at >= start_date)
    AND (end_date IS NULL OR al.created_at <= end_date)
    AND al.severity_score >= min_severity
    ORDER BY al.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default retention policies
INSERT INTO activity_log_retention_policies (category, level, retention_days, created_by)
VALUES 
    ('authentication', 'info', 90, (SELECT id FROM auth.users LIMIT 1)),
    ('authentication', 'warning', 180, (SELECT id FROM auth.users LIMIT 1)),
    ('authentication', 'error', 365, (SELECT id FROM auth.users LIMIT 1)),
    ('authentication', 'critical', 730, (SELECT id FROM auth.users LIMIT 1)),
    
    ('authorization', 'info', 90, (SELECT id FROM auth.users LIMIT 1)),
    ('authorization', 'warning', 180, (SELECT id FROM auth.users LIMIT 1)),
    ('authorization', 'error', 365, (SELECT id FROM auth.users LIMIT 1)),
    ('authorization', 'critical', 730, (SELECT id FROM auth.users LIMIT 1)),
    
    ('security', 'info', 180, (SELECT id FROM auth.users LIMIT 1)),
    ('security', 'warning', 365, (SELECT id FROM auth.users LIMIT 1)),
    ('security', 'error', 730, (SELECT id FROM auth.users LIMIT 1)),
    ('security', 'critical', 1095, (SELECT id FROM auth.users LIMIT 1)),
    
    ('user_management', 'info', 90, (SELECT id FROM auth.users LIMIT 1)),
    ('user_management', 'warning', 180, (SELECT id FROM auth.users LIMIT 1)),
    ('user_management', 'error', 365, (SELECT id FROM auth.users LIMIT 1)),
    ('user_management', 'critical', 730, (SELECT id FROM auth.users LIMIT 1)),
    
    ('system_administration', 'info', 180, (SELECT id FROM auth.users LIMIT 1)),
    ('system_administration', 'warning', 365, (SELECT id FROM auth.users LIMIT 1)),
    ('system_administration', 'error', 730, (SELECT id FROM auth.users LIMIT 1)),
    ('system_administration', 'critical', 1095, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (category, level) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_logs TO authenticated;
GRANT SELECT ON activity_log_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log_retention_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log_exports TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_activity_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION update_activity_log_stats(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_log_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION search_activity_logs(TEXT, UUID, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, INTEGER, INTEGER) TO authenticated;

-- Create a scheduled job to clean up expired logs (if pg_cron is available)
-- This would typically be set up in the Supabase dashboard or via a cron job
-- SELECT cron.schedule('cleanup-expired-logs', '0 2 * * *', 'SELECT cleanup_expired_activity_logs();');

-- --- 20250102000002_team_collaboration.sql ---
-- Migration: Team Collaboration System
-- Description: Create team/organization data model with member management, invitations, and content sharing

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. Teams/Organizations Table
-- ========================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    website_url TEXT,
    industry VARCHAR(100),
    size_category VARCHAR(50) CHECK (size_category IN ('startup', 'small', 'medium', 'enterprise')),
    billing_email TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 2. Team Members Table
-- ========================================

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID,
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'pending', 'suspended', 'left')),
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(team_id, user_id)
);

-- ========================================
-- 3. Team Invitations Table
-- ========================================

CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    invited_by UUID NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_id, email)
);

-- ========================================
-- 4. Team Content Sharing Table
-- ========================================

CREATE TABLE IF NOT EXISTS team_content_sharing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'media', 'campaign', 'template', 'analytics')),
    content_id TEXT NOT NULL,
    shared_by TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_id, content_type, content_id)
);

-- ========================================
-- 5. Team Activity Logs Table
-- ========================================

CREATE TABLE IF NOT EXISTS team_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 6. Team Workspaces Table
-- ========================================

CREATE TABLE IF NOT EXISTS team_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 7. Workspace Members Table
-- ========================================

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(workspace_id, user_id)
);

-- ========================================
-- Indexes for Performance
-- ========================================

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Team invitations indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires_at ON team_invitations(expires_at);

-- Team content sharing indexes
CREATE INDEX IF NOT EXISTS idx_team_content_sharing_team_id ON team_content_sharing(team_id);
CREATE INDEX IF NOT EXISTS idx_team_content_sharing_content ON team_content_sharing(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_team_content_sharing_shared_by ON team_content_sharing(shared_by);

-- Team activity logs indexes
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_team_id ON team_activity_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_user_id ON team_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_action ON team_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_created_at ON team_activity_logs(created_at);

-- Team workspaces indexes
CREATE INDEX IF NOT EXISTS idx_team_workspaces_team_id ON team_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_is_default ON team_workspaces(is_default);

-- Workspace members indexes
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- ========================================
-- Triggers for updated_at
-- ========================================

CREATE TRIGGER update_teams_updated_at 
    BEFORE UPDATE ON teams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at 
    BEFORE UPDATE ON team_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_content_sharing_updated_at 
    BEFORE UPDATE ON team_content_sharing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_workspaces_updated_at 
    BEFORE UPDATE ON team_workspaces 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_content_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view teams they belong to" ON teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_id = teams.id 
            AND user_id = auth.uid()::text 
            AND status = 'active'
        )
    );

CREATE POLICY "Team owners can update their teams" ON teams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_id = teams.id 
            AND user_id = auth.uid()::text 
            AND role = 'owner'
        )
    );

CREATE POLICY "Users can create teams" ON teams
    FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);

-- Team members policies
CREATE POLICY "Team members can view team membership" ON team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_members.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team owners can manage members" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_members.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.role = 'owner'
        )
    );

CREATE POLICY "Users can join teams via invitation" ON team_members
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id AND
        EXISTS (
            SELECT 1 FROM team_invitations ti
            WHERE ti.team_id = team_members.team_id
            AND ti.email = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND ti.status = 'accepted'
        )
    );

-- Team invitations policies
CREATE POLICY "Team owners can manage invitations" ON team_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_invitations.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Invited users can view their invitations" ON team_invitations
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Team content sharing policies
CREATE POLICY "Team members can view shared content" ON team_content_sharing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_content_sharing.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team members can share content" ON team_content_sharing
    FOR INSERT WITH CHECK (
        auth.uid()::text = shared_by AND
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_content_sharing.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.status = 'active'
        )
    );

-- Team activity logs policies
CREATE POLICY "Team members can view team activity" ON team_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_activity_logs.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.status = 'active'
        )
    );

CREATE POLICY "System can log team activity" ON team_activity_logs
    FOR INSERT WITH CHECK (true);

-- Team workspaces policies
CREATE POLICY "Team members can view workspaces" ON team_workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_workspaces.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team admins can manage workspaces" ON team_workspaces
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm 
            WHERE tm.team_id = team_workspaces.team_id 
            AND tm.user_id = auth.uid()::text 
            AND tm.role IN ('owner', 'admin')
        )
    );

-- Workspace members policies
CREATE POLICY "Workspace members can view membership" ON workspace_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Workspace owners can manage members" ON workspace_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid()::text 
            AND wm.role = 'owner'
        )
    );

-- ========================================
-- Helper Functions
-- ========================================

-- Function to generate team slug from name
CREATE OR REPLACE FUNCTION generate_team_slug(team_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base slug from team name
    base_slug := lower(regexp_replace(team_name, '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Ensure it's not empty
    IF base_slug = '' THEN
        base_slug := 'team';
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM teams WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to create default workspace for new team
CREATE OR REPLACE FUNCTION create_default_workspace_for_team()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO team_workspaces (team_id, name, description, is_default, created_by)
    VALUES (NEW.id, 'General', 'Default workspace for ' || NEW.name, TRUE, NEW.created_by);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default workspace when team is created
CREATE TRIGGER create_default_workspace_trigger
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION create_default_workspace_for_team();

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE team_invitations 
    SET status = 'expired'
    WHERE expires_at < NOW() AND status = 'pending';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get team member permissions
CREATE OR REPLACE FUNCTION get_team_member_permissions(team_uuid UUID, user_text TEXT)
RETURNS JSONB AS $$
DECLARE
    member_role TEXT;
    member_permissions JSONB;
BEGIN
    SELECT role, permissions INTO member_role, member_permissions
    FROM team_members
    WHERE team_id = team_uuid 
    AND user_id = user_text 
    AND status = 'active';
    
    IF member_role IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;
    
    -- Merge role-based permissions with custom permissions
    RETURN COALESCE(member_permissions, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Grant Permissions
-- ========================================

GRANT ALL ON teams TO authenticated;
GRANT ALL ON team_members TO authenticated;
GRANT ALL ON team_invitations TO authenticated;
GRANT ALL ON team_content_sharing TO authenticated;
GRANT ALL ON team_activity_logs TO authenticated;
GRANT ALL ON team_workspaces TO authenticated;
GRANT ALL ON workspace_members TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION generate_team_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_default_workspace_for_team() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_member_permissions(UUID, TEXT) TO authenticated;

-- --- 20250103000000_team_collaboration_fix.sql ---
-- Safe Migration: Team Collaboration System
-- This script safely creates tables, functions, and policies without conflicts

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. Drop existing triggers and functions first (if any)
-- ========================================

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trigger_create_default_workspace ON teams;
DROP TRIGGER IF EXISTS create_default_workspace_trigger ON teams;

-- Drop functions after triggers are dropped
DROP FUNCTION IF EXISTS create_default_workspace_for_team();
DROP FUNCTION IF EXISTS generate_team_slug(TEXT);

-- ========================================
-- 2. Drop existing policies (if any)
-- ========================================

-- Drop policies for teams table
DROP POLICY IF EXISTS "Users can view teams they belong to" ON teams;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON teams;

-- Drop policies for team_members table
DROP POLICY IF EXISTS "Users can view team members of teams they belong to" ON team_members;
DROP POLICY IF EXISTS "Team owners can manage members" ON team_members;

-- Drop policies for team_invitations table
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON team_invitations;
DROP POLICY IF EXISTS "Team owners can manage invitations" ON team_invitations;

-- Drop policies for team_content_sharing table
DROP POLICY IF EXISTS "Team members can view shared content" ON team_content_sharing;
DROP POLICY IF EXISTS "Team members can share content" ON team_content_sharing;

-- Drop policies for team_activity_logs table
DROP POLICY IF EXISTS "Team members can view activity logs" ON team_activity_logs;
DROP POLICY IF EXISTS "System can insert activity logs" ON team_activity_logs;

-- Drop policies for team_workspaces table
DROP POLICY IF EXISTS "Team members can view workspaces" ON team_workspaces;
DROP POLICY IF EXISTS "Team owners can manage workspaces" ON team_workspaces;

-- Drop policies for workspace_members table
DROP POLICY IF EXISTS "Workspace members can view other members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;

-- ========================================
-- 3. Create Tables (IF NOT EXISTS handles existing tables)
-- ========================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    website_url TEXT,
    industry VARCHAR(100),
    size_category VARCHAR(50) CHECK (size_category IN ('startup', 'small', 'medium', 'enterprise')),
    billing_email TEXT,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by TEXT,
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'pending', 'suspended', 'left')),
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    invited_by TEXT NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(team_id, email)
);

CREATE TABLE IF NOT EXISTS team_content_sharing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('post', 'media', 'template', 'campaign')),
    shared_by TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(team_id, content_id, content_type)
);

CREATE TABLE IF NOT EXISTS team_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES team_workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('admin', 'editor', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by TEXT,
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'pending', 'suspended', 'left')),
    
    UNIQUE(workspace_id, user_id)
);

-- ========================================
-- 4. Create Indexes (IF NOT EXISTS)
-- ========================================

CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

CREATE INDEX IF NOT EXISTS idx_team_content_sharing_team_id ON team_content_sharing(team_id);
CREATE INDEX IF NOT EXISTS idx_team_content_sharing_content_id ON team_content_sharing(content_id);

CREATE INDEX IF NOT EXISTS idx_team_activity_logs_team_id ON team_activity_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_user_id ON team_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_created_at ON team_activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_team_workspaces_team_id ON team_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_is_default ON team_workspaces(is_default);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- ========================================
-- 5. Create Functions
-- ========================================

-- Function to generate team slug
CREATE OR REPLACE FUNCTION generate_team_slug(team_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert to lowercase, replace spaces and special chars with hyphens
    base_slug := lower(regexp_replace(team_name, '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    
    -- Limit length
    base_slug := left(base_slug, 50);
    
    final_slug := base_slug;
    
    -- Check for uniqueness and add counter if needed
    WHILE EXISTS (SELECT 1 FROM teams WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to create default workspace for team
CREATE OR REPLACE FUNCTION create_default_workspace_for_team()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO team_workspaces (team_id, name, description, is_default, created_by)
    VALUES (NEW.id, 'Default Workspace', 'Default workspace for ' || NEW.name, TRUE, NEW.created_by);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. Create Triggers
-- ========================================

-- Trigger to create default workspace when team is created
CREATE TRIGGER trigger_create_default_workspace
    AFTER INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION create_default_workspace_for_team();

-- ========================================
-- 7. Enable RLS and Create Policies
-- ========================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_content_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Users can view teams they belong to" ON teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_members.team_id = teams.id 
            AND team_members.user_id = auth.uid()::text
            AND team_members.status = 'active'
        )
    );

CREATE POLICY "Users can create teams" ON teams
    FOR INSERT WITH CHECK (created_by::text = auth.uid()::text);

CREATE POLICY "Team owners can update their teams" ON teams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM team_members 
            WHERE team_members.team_id = teams.id 
            AND team_members.user_id = auth.uid()::text
            AND team_members.role = 'owner'
            AND team_members.status = 'active'
        )
    );

-- Team members policies
CREATE POLICY "Users can view team members of teams they belong to" ON team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team owners can manage members" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    );

-- Team invitations policies
CREATE POLICY "Users can view invitations sent to them" ON team_invitations
    FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Team owners can manage invitations" ON team_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_invitations.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    );

-- Team content sharing policies
CREATE POLICY "Team members can view shared content" ON team_content_sharing
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_content_sharing.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team members can share content" ON team_content_sharing
    FOR INSERT WITH CHECK (
        shared_by = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_content_sharing.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.status = 'active'
        )
    );

-- Team activity logs policies
CREATE POLICY "Team members can view activity logs" ON team_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_activity_logs.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.status = 'active'
        )
    );

CREATE POLICY "System can insert activity logs" ON team_activity_logs
    FOR INSERT WITH CHECK (true);

-- Team workspaces policies
CREATE POLICY "Team members can view workspaces" ON team_workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_workspaces.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.status = 'active'
        )
    );

CREATE POLICY "Team owners can manage workspaces" ON team_workspaces
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_workspaces.team_id 
            AND tm.user_id = auth.uid()::text
            AND tm.role IN ('owner', 'admin')
            AND tm.status = 'active'
        )
    );

-- Workspace members policies
CREATE POLICY "Workspace members can view other members" ON workspace_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Workspace admins can manage members" ON workspace_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid()::text
            AND wm.role IN ('admin')
        )
    );

-- ========================================
-- 8. Grant Permissions
-- ========================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;



-- --- 20250120000000_engagement_automation.sql ---
-- Migration: Engagement Automation and Auto-Reply System
-- Date: 2025-01-20
-- Description: Creates tables for mention monitoring, auto-reply rules, sentiment analysis, and engagement analytics

BEGIN;

-- ========================================
-- 1. Create auto_reply_rules table
-- ========================================

CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    phrases TEXT[] DEFAULT '{}',
    response_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    throttle_settings JSONB DEFAULT '{"max_per_hour": 10, "max_per_day": 50, "cooldown_minutes": 5}',
    match_type TEXT DEFAULT 'any' CHECK (match_type IN ('any', 'all')),
    sentiment_filter TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, rule_name)
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_user_id ON auto_reply_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_active ON auto_reply_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_auto_reply_rules_priority ON auto_reply_rules(priority DESC);

CREATE TRIGGER update_auto_reply_rules_updated_at 
    BEFORE UPDATE ON auto_reply_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own auto_reply_rules" ON auto_reply_rules
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON auto_reply_rules TO authenticated;
GRANT ALL ON auto_reply_rules TO anon;

-- ========================================
-- 2. Create mentions table
-- ========================================

CREATE TABLE IF NOT EXISTS mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    tweet_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_username TEXT NOT NULL,
    author_name TEXT,
    text TEXT NOT NULL,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    sentiment_confidence DECIMAL(3, 2) DEFAULT 0.0 CHECK (sentiment_confidence >= 0 AND sentiment_confidence <= 1),
    priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
    is_flagged BOOLEAN DEFAULT false,
    is_replied BOOLEAN DEFAULT false,
    reply_id TEXT,
    reply_text TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user_id ON mentions(user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_created_at ON mentions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_is_flagged ON mentions(is_flagged) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_mentions_sentiment ON mentions(sentiment);
CREATE INDEX IF NOT EXISTS idx_mentions_tweet_id ON mentions(tweet_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user_created ON mentions(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own mentions" ON mentions
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON mentions TO authenticated;
GRANT ALL ON mentions TO anon;

-- ========================================
-- 3. Create auto_reply_logs table
-- ========================================

CREATE TABLE IF NOT EXISTS auto_reply_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id UUID REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
    mention_id UUID REFERENCES mentions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    response_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    tweet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_rule_id ON auto_reply_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_mention_id ON auto_reply_logs(mention_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_user_id ON auto_reply_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_sent_at ON auto_reply_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_reply_logs_success ON auto_reply_logs(success);

-- Enable RLS
ALTER TABLE auto_reply_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own auto_reply_logs" ON auto_reply_logs
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON auto_reply_logs TO authenticated;
GRANT ALL ON auto_reply_logs TO anon;

-- ========================================
-- 4. Create mention_analytics table
-- ========================================

CREATE TABLE IF NOT EXISTS mention_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_mentions INTEGER DEFAULT 0,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    auto_replies_sent INTEGER DEFAULT 0,
    flagged_count INTEGER DEFAULT 0,
    avg_priority_score DECIMAL(5, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mention_analytics_user_id ON mention_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_mention_analytics_date ON mention_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_mention_analytics_user_date ON mention_analytics(user_id, date DESC);

CREATE TRIGGER update_mention_analytics_updated_at 
    BEFORE UPDATE ON mention_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE mention_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own mention_analytics" ON mention_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON mention_analytics TO authenticated;
GRANT ALL ON mention_analytics TO anon;

-- ========================================
-- 5. Create function to update analytics
-- ========================================

CREATE OR REPLACE FUNCTION update_mention_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO mention_analytics (
        user_id,
        date,
        total_mentions,
        positive_count,
        negative_count,
        neutral_count,
        flagged_count,
        avg_priority_score
    )
    SELECT 
        user_id,
        DATE(created_at) as date,
        COUNT(*) as total_mentions,
        COUNT(*) FILTER (WHERE sentiment = 'positive') as positive_count,
        COUNT(*) FILTER (WHERE sentiment = 'negative') as negative_count,
        COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral_count,
        COUNT(*) FILTER (WHERE is_flagged = true) as flagged_count,
        COALESCE(AVG(priority_score), 0) as avg_priority_score
    FROM mentions
    WHERE user_id = NEW.user_id
      AND DATE(created_at) = DATE(NEW.created_at)
    GROUP BY user_id, DATE(created_at)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET
        total_mentions = EXCLUDED.total_mentions,
        positive_count = EXCLUDED.positive_count,
        negative_count = EXCLUDED.negative_count,
        neutral_count = EXCLUDED.neutral_count,
        flagged_count = EXCLUDED.flagged_count,
        avg_priority_score = EXCLUDED.avg_priority_score,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update analytics when mentions are inserted
CREATE TRIGGER trigger_update_mention_analytics
    AFTER INSERT ON mentions
    FOR EACH ROW
    EXECUTE FUNCTION update_mention_analytics();

COMMIT;


-- --- 20250130000001_add_timezone_support.sql ---
-- Migration: Add Timezone Support and Job Queue Fields to scheduled_posts
-- Date: 2025-01-30
-- Description: Adds timezone support columns and job queue tracking fields for enhanced scheduling system

-- Add timezone support columns
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS user_timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS scheduled_timezone TEXT DEFAULT 'UTC';

-- Add job queue tracking fields
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS conflict_window_minutes INTEGER DEFAULT 5;

-- Add index for queue processing (optimize queries for scheduled posts)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
ON scheduled_posts(status, scheduled_at) 
WHERE status IN ('scheduled', 'pending_approval');

-- Add index for conflict detection (optimize time range queries)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_scheduled_at 
ON scheduled_posts(user_id, scheduled_at)
WHERE status IN ('scheduled', 'pending_approval', 'approved');



-- --- 20250130000002_add_approval_columns.sql ---
-- Migration: Add Approval Workflow Columns to scheduled_posts
-- Date: 2025-01-30
-- Description: Adds requires_approval and submitted_for_approval_at columns for approval workflow support

-- Add approval workflow columns
ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ;

-- Add index for approval workflow queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_requires_approval 
ON scheduled_posts(requires_approval, status)
WHERE requires_approval = true;



-- --- 20250201000000_analytics_pipeline.sql ---
-- Migration: Analytics Data Processing Pipeline
-- Date: 2025-02-01
-- Description: Creates tables for X API post analytics, follower analytics, and sync job tracking

BEGIN;

-- ========================================
-- 1. Create post_analytics table
-- ========================================

CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL, -- X tweet ID
    scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL, -- Optional FK, NULL for posts not created through app
    tweet_text TEXT, -- Store tweet content for reference
    tweet_created_at TIMESTAMPTZ, -- Original tweet timestamp from X
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(10, 4) DEFAULT 0.0, -- Calculated: (likes + retweets + replies + quotes) / impressions
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id) -- Prevent duplicate analytics for same post
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_user_id ON post_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX IF NOT EXISTS idx_post_analytics_collected_at ON post_analytics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_scheduled_post_id ON post_analytics(scheduled_post_id) WHERE scheduled_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at ON post_analytics(tweet_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at ON post_analytics(user_id, tweet_created_at DESC);

CREATE TRIGGER update_post_analytics_updated_at 
    BEFORE UPDATE ON post_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own post_analytics" ON post_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON post_analytics TO authenticated;
GRANT ALL ON post_analytics TO anon;

-- ========================================
-- 2. Create follower_analytics table
-- ========================================

CREATE TABLE IF NOT EXISTS follower_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tweet_count INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date) -- One record per user per day
);

CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_id ON follower_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_date ON follower_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_date ON follower_analytics(user_id, date DESC);

CREATE TRIGGER update_follower_analytics_updated_at 
    BEFORE UPDATE ON follower_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE follower_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own follower_analytics" ON follower_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON follower_analytics TO authenticated;
GRANT ALL ON follower_analytics TO anon;

-- ========================================
-- 3. Create analytics_sync_jobs table
-- ========================================

CREATE TABLE IF NOT EXISTS analytics_sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('post_analytics', 'follower_analytics', 'both')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    posts_processed INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    sync_options JSONB, -- Store sync options like {days: 7, syncAll: false}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_user_id ON analytics_sync_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_status ON analytics_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_created_at ON analytics_sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sync_jobs_user_status ON analytics_sync_jobs(user_id, status);

CREATE TRIGGER update_analytics_sync_jobs_updated_at 
    BEFORE UPDATE ON analytics_sync_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE analytics_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own analytics_sync_jobs" ON analytics_sync_jobs
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions
GRANT ALL ON analytics_sync_jobs TO authenticated;
GRANT ALL ON analytics_sync_jobs TO anon;

COMMIT;

-- --- 20250827102426_approval_workflow.sql ---
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
CREATE OR REPLACE VIEW posts_pending_approval
WITH (security_invoker = true)
AS
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
CREATE OR REPLACE VIEW approval_statistics
WITH (security_invoker = true)
AS
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

-- --- 20251115094500_approval_workflow_enhancements.sql ---
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

CREATE OR REPLACE VIEW approval_dashboard_summary
WITH (security_invoker = true)
AS
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


-- --- 20251214000000_update_post_analytics_constraint.sql ---


-- --- 20251215000000_ensure_follower_analytics_table.sql ---
-- Migration: Ensure follower_analytics table exists
-- Date: 2025-12-15
-- Description: Idempotent migration to ensure follower_analytics table exists
-- This fixes the issue where the table might not have been created from the original migration

-- Create follower_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS follower_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    tweet_count INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date) -- One record per user per day
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_id ON follower_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_date ON follower_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_follower_analytics_user_date ON follower_analytics(user_id, date DESC);

-- Create trigger for updated_at (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS update_follower_analytics_updated_at ON follower_analytics;
CREATE TRIGGER update_follower_analytics_updated_at 
    BEFORE UPDATE ON follower_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE follower_analytics ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists, then create
DROP POLICY IF EXISTS "Users can view their own follower_analytics" ON follower_analytics;
CREATE POLICY "Users can view their own follower_analytics" ON follower_analytics
    FOR ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user');

-- Grant permissions (idempotent - safe to run multiple times)
GRANT ALL ON follower_analytics TO authenticated;
GRANT ALL ON follower_analytics TO anon;

-- --- 20251216000000_add_scheduled_post_id_to_post_analytics.sql ---
-- Migration: Add scheduled_post_id column to post_analytics table
-- Date: 2025-12-16
-- Description: Adds scheduled_post_id column if it doesn't exist to support linking analytics to scheduled posts

-- Add scheduled_post_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id'
    ) THEN
        ALTER TABLE post_analytics 
        ADD COLUMN scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL;
        
        -- Create index for scheduled_post_id if it doesn't exist
        CREATE INDEX IF NOT EXISTS idx_post_analytics_scheduled_post_id 
        ON post_analytics(scheduled_post_id) 
        WHERE scheduled_post_id IS NOT NULL;
        
        RAISE NOTICE 'Added scheduled_post_id column to post_analytics table';
    ELSE
        RAISE NOTICE 'Column scheduled_post_id already exists in post_analytics table';
    END IF;
END $$;


-- --- 20251217000000_make_credential_fields_nullable.sql ---
-- Migration: Make credential fields nullable to support different credential types
-- Date: 2025-12-17
-- Description: Makes credential fields nullable to support Apify credentials which only require an API key
-- Apify only requires an API key, while X API requires multiple fields

-- Make encrypted_api_secret nullable (not needed for Apify)
DO $$ 
BEGIN
    -- Check if column exists and is NOT NULL before altering
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_credentials' 
        AND column_name = 'encrypted_api_secret'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE user_credentials 
        ALTER COLUMN encrypted_api_secret DROP NOT NULL;
        RAISE NOTICE 'Made encrypted_api_secret nullable';
    ELSE
        RAISE NOTICE 'encrypted_api_secret is already nullable or does not exist';
    END IF;
END $$;

-- Make encrypted_access_token nullable (not needed for Apify)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_credentials' 
        AND column_name = 'encrypted_access_token'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE user_credentials 
        ALTER COLUMN encrypted_access_token DROP NOT NULL;
        RAISE NOTICE 'Made encrypted_access_token nullable';
    ELSE
        RAISE NOTICE 'encrypted_access_token is already nullable or does not exist';
    END IF;
END $$;

-- Make encrypted_access_secret nullable (not needed for Apify)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_credentials' 
        AND column_name = 'encrypted_access_secret'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE user_credentials 
        ALTER COLUMN encrypted_access_secret DROP NOT NULL;
        RAISE NOTICE 'Made encrypted_access_secret nullable';
    ELSE
        RAISE NOTICE 'encrypted_access_secret is already nullable or does not exist';
    END IF;
END $$;

-- Add comments explaining the change
COMMENT ON COLUMN user_credentials.encrypted_api_secret IS 'Required for X API credentials, optional for Apify';
COMMENT ON COLUMN user_credentials.encrypted_access_token IS 'Required for X API credentials, optional for Apify';
COMMENT ON COLUMN user_credentials.encrypted_access_secret IS 'Required for X API credentials, optional for Apify';


-- --- 20251218000000_add_x_username_to_credentials.sql ---
-- Add x_username field to user_credentials table
-- This allows users to manually enter their X username to avoid rate limit issues

ALTER TABLE user_credentials 
ADD COLUMN IF NOT EXISTS x_username TEXT;

-- Create index for faster lookups by username
CREATE INDEX IF NOT EXISTS idx_user_credentials_x_username ON user_credentials(x_username) WHERE x_username IS NOT NULL;

-- Add comment
COMMENT ON COLUMN user_credentials.x_username IS 'Manually entered X/Twitter username to avoid rate limit issues when fetching from X API';


-- --- 20251218000001_ensure_post_analytics_unique_constraint.sql ---
-- Migration: Ensure post_analytics has unique constraint on (user_id, post_id)
-- Date: 2025-12-18
-- Description: Creates a named unique constraint if it doesn't exist to support ON CONFLICT in upserts

DO $$ 
DECLARE
    constraint_exists boolean;
    constraint_name text;
BEGIN
    -- Check if any unique constraint exists on (user_id, post_id)
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'post_analytics'
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
            (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[1]) = 'user_id'
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[2]) = 'post_id'
        )
    ) INTO constraint_exists;
    
    -- Get the constraint name if it exists
    IF constraint_exists THEN
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'post_analytics'
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
            (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[1]) = 'user_id'
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[2]) = 'post_id'
        )
        LIMIT 1;
        
        RAISE NOTICE 'Unique constraint on (user_id, post_id) already exists: %', constraint_name;
    ELSE
        -- Drop any existing constraint with the same name (in case it's on different columns)
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Create a named unique constraint
        ALTER TABLE post_analytics 
        ADD CONSTRAINT post_analytics_user_id_post_id_key 
        UNIQUE (user_id, post_id);
        
        RAISE NOTICE 'Created unique constraint post_analytics_user_id_post_id_key on (user_id, post_id)';
    END IF;
END $$;


-- --- 20251218000002_fix_post_analytics_post_id_type.sql ---
-- Migration: Fix post_analytics post_id column type
-- Date: 2025-12-18
-- Description: Ensures post_id is TEXT (for tweet IDs) and not UUID, removes any incorrect foreign key constraints

DO $$ 
DECLARE
    current_type text;
    has_fk boolean;
    fk_name text;
    row_count integer;
BEGIN
    -- Check current data type of post_id
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'post_analytics' 
    AND column_name = 'post_id';
    
    -- Check if there's a foreign key constraint on post_id
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'post_analytics'
        AND kcu.column_name = 'post_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    ) INTO has_fk;
    
    -- Get foreign key name if it exists
    IF has_fk THEN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'post_analytics'
        AND kcu.column_name = 'post_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        LIMIT 1;
        
        RAISE NOTICE 'Found foreign key constraint on post_id: %. Dropping it...', fk_name;
        EXECUTE format('ALTER TABLE post_analytics DROP CONSTRAINT IF EXISTS %I', fk_name);
    END IF;
    
    -- If post_id is UUID, change it to TEXT
    -- NOTE: If post_id is UUID, it means the schema is wrong - post_id should store tweet IDs (TEXT)
    -- UUIDs and tweet IDs are incompatible formats, so we need to handle this carefully
    IF current_type = 'uuid' THEN
        RAISE NOTICE 'post_id is currently UUID (INCORRECT TYPE), converting to TEXT...';
        RAISE NOTICE 'WARNING: post_id should store tweet IDs (TEXT), not UUIDs. Converting type...';
        
        -- Check if there's existing data
        SELECT COUNT(*) INTO row_count FROM post_analytics;
        IF row_count > 0 THEN
            RAISE NOTICE 'Found % existing rows. UUID values in post_id cannot be preserved as tweet IDs.', row_count;
            RAISE NOTICE 'These rows will need to be re-synced with correct tweet IDs from the analytics source.';
        END IF;
        
        -- Drop any constraints that depend on post_id
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Change the column type to TEXT
        -- Since UUIDs and tweet IDs are incompatible, convert UUIDs to empty strings
        -- The data will need to be re-synced, but this prevents the type error
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id TYPE TEXT USING '';
        
        -- Set NOT NULL constraint (but allow empty strings temporarily for migration)
        -- Actually, we should allow NULL temporarily, then set NOT NULL after data is re-synced
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id DROP NOT NULL;
        
        RAISE NOTICE 'Converted post_id from UUID to TEXT. Existing rows have empty post_id and need re-sync.';
    ELSIF current_type IS NULL THEN
        RAISE NOTICE 'post_id column does not exist, creating as TEXT...';
        ALTER TABLE post_analytics 
        ADD COLUMN post_id TEXT NOT NULL;
    ELSIF current_type != 'text' THEN
        RAISE NOTICE 'post_id is currently %, converting to TEXT...', current_type;
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id TYPE TEXT USING post_id::text;
    ELSE
        RAISE NOTICE 'post_id is already TEXT, no change needed';
    END IF;
    
    -- Ensure post_id is NOT NULL (it should be) - but only if it's not already UUID (which we handle above)
    IF current_type != 'uuid' THEN
        ALTER TABLE post_analytics 
        ALTER COLUMN post_id SET NOT NULL;
    END IF;
    
    -- Ensure scheduled_post_id is UUID (it should be)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id'
    ) THEN
        SELECT data_type INTO current_type
        FROM information_schema.columns
        WHERE table_name = 'post_analytics' 
        AND column_name = 'scheduled_post_id';
        
        IF current_type != 'uuid' THEN
            RAISE NOTICE 'scheduled_post_id is currently %, converting to UUID...', current_type;
            -- This might fail if there's invalid data, but scheduled_post_id should be nullable
            ALTER TABLE post_analytics 
            ALTER COLUMN scheduled_post_id TYPE UUID USING NULLIF(scheduled_post_id::text, '')::uuid;
        ELSE
            RAISE NOTICE 'scheduled_post_id is already UUID';
        END IF;
    END IF;
    
END $$;

-- Clean up invalid data and handle duplicates before creating unique constraint
DO $$
DECLARE
    duplicate_count integer;
    empty_post_id_count integer;
    current_type_check text;
BEGIN
    -- Check current type to see if we just converted from UUID
    SELECT data_type INTO current_type_check
    FROM information_schema.columns
    WHERE table_name = 'post_analytics' 
    AND column_name = 'post_id';
    -- Count rows with empty or NULL post_id
    SELECT COUNT(*) INTO empty_post_id_count 
    FROM post_analytics 
    WHERE post_id IS NULL OR post_id = '';
    
    IF empty_post_id_count > 0 THEN
        RAISE NOTICE 'Found % rows with empty/NULL post_id. These have invalid data and will be removed.', empty_post_id_count;
        
        -- Delete rows with empty or NULL post_id since they're invalid (can't be tweet IDs)
        DELETE FROM post_analytics 
        WHERE post_id IS NULL OR post_id = '';
        
        RAISE NOTICE 'Removed % invalid rows with empty post_id', empty_post_id_count;
    END IF;
    
    -- Check for remaining duplicates (shouldn't happen after cleanup, but be safe)
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, post_id, COUNT(*) as cnt
        FROM post_analytics
        WHERE post_id IS NOT NULL AND post_id != ''
        GROUP BY user_id, post_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate (user_id, post_id) combinations. Keeping only the most recent row for each...', duplicate_count;
        
        -- Delete duplicates, keeping only the most recent row (by collected_at or created_at)
        DELETE FROM post_analytics
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id, post_id 
                           ORDER BY COALESCE(collected_at, created_at) DESC
                       ) as rn
                FROM post_analytics
                WHERE post_id IS NOT NULL AND post_id != ''
            ) ranked
            WHERE rn > 1
        );
        
        RAISE NOTICE 'Removed duplicate rows, kept most recent for each (user_id, post_id) combination';
    END IF;
    
    -- After cleanup, ensure post_id is NOT NULL (if it's TEXT type)
    -- This is safe now because we've removed all NULL/empty values
    IF current_type_check = 'text' THEN
        -- Check if there are any NULL values remaining
        IF NOT EXISTS (SELECT 1 FROM post_analytics WHERE post_id IS NULL) THEN
            ALTER TABLE post_analytics 
            ALTER COLUMN post_id SET NOT NULL;
            RAISE NOTICE 'Set post_id to NOT NULL after cleanup';
        ELSE
            RAISE WARNING 'Cannot set post_id to NOT NULL: NULL values still exist';
        END IF;
    END IF;
END $$;

-- Recreate the unique constraint if it doesn't exist
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    -- Check if constraint already exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'post_analytics'
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
        AND (
            (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[1]) = 'user_id'
            AND (SELECT attname FROM pg_attribute WHERE attrelid = t.oid AND attnum = c.conkey[2]) = 'post_id'
        )
    ) INTO constraint_exists;
    
    IF NOT constraint_exists THEN
        -- Drop constraint if it exists with different definition
        ALTER TABLE post_analytics 
        DROP CONSTRAINT IF EXISTS post_analytics_user_id_post_id_key;
        
        -- Only create constraint if there are no NULL or empty post_id values
        -- (We already cleaned those up, but double-check)
        IF NOT EXISTS (
            SELECT 1 FROM post_analytics 
            WHERE post_id IS NULL OR post_id = ''
        ) THEN
            ALTER TABLE post_analytics 
            ADD CONSTRAINT post_analytics_user_id_post_id_key 
            UNIQUE (user_id, post_id);
            
            RAISE NOTICE 'Created unique constraint on (user_id, post_id)';
        ELSE
            RAISE WARNING 'Cannot create unique constraint: rows with empty/NULL post_id still exist';
        END IF;
    ELSE
        RAISE NOTICE 'Unique constraint on (user_id, post_id) already exists';
    END IF;
END $$;


-- --- 20251218000003_ensure_tweet_id_column.sql ---
-- Migration: Ensure tweet_id column exists in post_analytics
-- Date: 2025-12-18
-- Description: Adds tweet_id column if it doesn't exist, or ensures it's properly configured

DO $$ 
BEGIN
    -- Check if tweet_id column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'tweet_id'
    ) THEN
        -- (1) Add tweet_id column as nullable to avoid NOT NULL failure on non-empty tables
        ALTER TABLE post_analytics 
        ADD COLUMN tweet_id TEXT;
        
        -- (2) Populate tweet_id from post_id for existing rows
        UPDATE post_analytics 
        SET tweet_id = post_id 
        WHERE tweet_id IS NULL;
        
        -- (3) Now set NOT NULL after all rows are populated (no temp DEFAULT, final schema is clean)
        ALTER TABLE post_analytics 
        ALTER COLUMN tweet_id SET NOT NULL;
        
        -- Create index on tweet_id for performance
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_id 
        ON post_analytics(tweet_id);
        
        RAISE NOTICE 'Added tweet_id column to post_analytics table and populated from post_id';
    ELSE
        -- Column exists, ensure it's NOT NULL and populated
        -- First, populate any NULL values from post_id
        UPDATE post_analytics 
        SET tweet_id = post_id 
        WHERE tweet_id IS NULL OR tweet_id = '';
        
        -- Then ensure it's NOT NULL
        ALTER TABLE post_analytics 
        ALTER COLUMN tweet_id SET NOT NULL;
        
        -- Ensure index exists
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_id 
        ON post_analytics(tweet_id);
        
        RAISE NOTICE 'tweet_id column already exists, ensured it is NOT NULL and populated';
    END IF;
END $$;


-- --- 20251218000004_ensure_tweet_created_at_column.sql ---
-- Migration: Ensure tweet_created_at column exists and is properly configured
-- Date: 2025-12-18
-- Description: Ensures tweet_created_at column exists in post_analytics table
-- This column stores the actual post date from X/Apify, not when analytics were collected

DO $$ 
BEGIN
    -- Check if tweet_created_at column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'tweet_created_at'
    ) THEN
        -- Add tweet_created_at column as TIMESTAMPTZ (nullable)
        ALTER TABLE post_analytics 
        ADD COLUMN tweet_created_at TIMESTAMPTZ;
        
        -- Create index on tweet_created_at for performance
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at 
        ON post_analytics(tweet_created_at DESC);
        
        -- Create composite index for user_id and tweet_created_at
        CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at 
        ON post_analytics(user_id, tweet_created_at DESC);
        
        RAISE NOTICE 'Added tweet_created_at column to post_analytics table';
    ELSE
        -- Column exists, ensure index exists
        CREATE INDEX IF NOT EXISTS idx_post_analytics_tweet_created_at 
        ON post_analytics(tweet_created_at DESC);
        
        CREATE INDEX IF NOT EXISTS idx_post_analytics_user_created_at 
        ON post_analytics(user_id, tweet_created_at DESC);
        
        RAISE NOTICE 'tweet_created_at column already exists, ensured indexes are present';
    END IF;
END $$;


-- --- 20251218000005_fix_approval_history_trigger.sql ---
-- Fix approval_history trigger to handle 'processing' status correctly
-- The trigger was trying to insert 'status_changed' which violates the check constraint
-- We should skip approval_history entries for internal queue statuses like 'processing'

CREATE OR REPLACE FUNCTION handle_approval_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert into approval_history for approval-related status changes
    -- Skip internal queue statuses like 'processing', 'failed', etc.
    IF OLD.status IS DISTINCT FROM NEW.status 
       AND NEW.status IN ('pending_approval', 'approved', 'rejected', 'published')
    THEN
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
                -- This should never happen due to the IF condition above, but included for safety
                ELSE 'submitted'
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


-- --- 20251218000006_add_processing_status.sql ---
-- Fix: Add 'processing' and 'cancelled' status to scheduled_posts status constraint
-- The job queue uses 'processing' status to lock jobs, but it wasn't in the allowed values

-- Drop the existing constraint (it might be named differently)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'scheduled_posts'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%check%'
    LIMIT 1;
    
    -- Drop it if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE scheduled_posts DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- Add the updated constraint with all required status values
ALTER TABLE scheduled_posts
ADD CONSTRAINT scheduled_posts_approval_status_check 
CHECK (status IN (
  'draft', 
  'pending_approval', 
  'approved', 
  'rejected', 
  'published', 
  'failed',
  'processing',  -- Added for job queue locking
  'cancelled'    -- Added for cancelled posts
));


-- --- 20251218000007_ensure_clicks_column.sql ---
-- Migration: Ensure clicks column exists in post_analytics
-- Date: 2025-12-18
-- Description: Adds clicks column to post_analytics if it doesn't exist
-- This fixes the PostgREST schema cache issue where clicks column wasn't recognized

DO $$
BEGIN
    -- Check if clicks column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'post_analytics' 
        AND column_name = 'clicks'
    ) THEN
        -- Add clicks column if it doesn't exist
        ALTER TABLE post_analytics 
        ADD COLUMN clicks INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added clicks column to post_analytics table';
    ELSE
        RAISE NOTICE 'clicks column already exists in post_analytics table';
    END IF;
END $$;

-- Note: After running this migration, you may need to refresh PostgREST schema cache
-- In Supabase, this is typically done automatically, but if issues persist:
-- 1. Restart your Supabase project
-- 2. Or wait for the schema cache to refresh (usually happens automatically)

-- --- 20260212000000_add_onboarding_to_user_profiles.sql ---
-- Add onboarding and help preference columns to user_profiles
-- onboarding_step: 0=welcome, 1=connect_x, 2=feature_intro, 3=complete
-- onboarding_completed_at: set when user finishes onboarding
-- tutorial_completed_at: set when user completes the feature tour
-- show_contextual_tooltips: user preference for tooltips (23.4)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS show_contextual_tooltips BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_profiles.onboarding_step IS 'Current onboarding step: 0=welcome, 1=connect_x, 2=feature_intro, 3=complete';
COMMENT ON COLUMN user_profiles.onboarding_completed_at IS 'When the user completed onboarding';
COMMENT ON COLUMN user_profiles.tutorial_completed_at IS 'When the user completed the feature tour';
COMMENT ON COLUMN user_profiles.show_contextual_tooltips IS 'Whether to show contextual tooltips in the app';

-- --- 20260214000000_notifications_system.sql ---
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

-- --- 20260214000001_notification_templates.sql ---
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

-- SMS templates (aligned with 20260413120000_sms_notification_templates.sql)
INSERT INTO notification_templates (event_type, notification_type, channel, locale, subject, body_template) VALUES
('approval', 'approval_approved', 'sms', 'en', NULL, 'Your post has been approved.'),
('approval', 'approval_rejected', 'sms', 'en', NULL, 'Your post was rejected.'),
('approval', 'approval_changes_requested', 'sms', 'en', NULL, 'Changes requested on your post.'),
('mention', 'new_mention', 'sms', 'en', NULL, 'You were mentioned by {{userName}}.'),
('system', 'test_notification', 'sms', 'en', NULL, 'Test notification from Social Autopilot.')
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

-- --- 20260215000000_account_settings_user_sessions.sql ---
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

-- --- 20260216000000_seed_demo_approval_workflow.sql ---
-- Demo approval workflow data moved to supabase/seed.sql (development only).
-- This migration is intentionally empty to avoid seeding demo data in all environments.

-- --- 20260217000000_email_verification.sql ---
-- Email verification (Option B: soft verification flag)
-- Add column to user_profiles and create token table for verification links

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN user_profiles.email_verified_at IS 'When the user verified their email via the verification link; null means not yet verified.';

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

COMMENT ON TABLE email_verifications IS 'One-time tokens for email verification links; used_at set when link is clicked.';
