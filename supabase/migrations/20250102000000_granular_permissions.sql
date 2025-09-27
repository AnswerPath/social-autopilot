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
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Ensure unique user-permission-resource combinations for active overrides
    UNIQUE(user_id, permission, resource_type, resource_id) 
    WHERE is_active = TRUE
);

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
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all custom permissions" ON custom_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can create custom permissions" ON custom_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Users can update custom permissions they created" ON custom_permissions
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins can update all custom permissions" ON custom_permissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- User Custom Permissions Policies
CREATE POLICY "Users can view their own custom permissions" ON user_custom_permissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user custom permissions" ON user_custom_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage user custom permissions" ON user_custom_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Resource Permissions Policies
CREATE POLICY "Users can view their own resource permissions" ON resource_permissions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all resource permissions" ON resource_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage resource permissions" ON resource_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Permission Overrides Policies
CREATE POLICY "Users can view their own permission overrides" ON permission_overrides
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permission overrides" ON permission_overrides
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage permission overrides" ON permission_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Permission Audit Log Policies
CREATE POLICY "Users can view their own permission audit logs" ON permission_audit_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permission audit logs" ON permission_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
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
    WHERE ur.user_id = p_user_id
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
