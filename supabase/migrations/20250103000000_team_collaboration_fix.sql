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
    FOR INSERT WITH CHECK (created_by = auth.uid()::text);

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
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Workspace admins can manage members" ON workspace_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id = auth.uid()::text
            AND wm.role IN ('admin')
            AND wm.status = 'active'
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


