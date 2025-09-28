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
    FOR INSERT WITH CHECK (auth.uid()::text = created_by);

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
