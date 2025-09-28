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
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity logs" ON activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can insert activity logs" ON activity_logs
    FOR INSERT WITH CHECK (true); -- Allow all inserts for logging

CREATE POLICY "Admins can manage activity logs" ON activity_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Activity Log Stats Policies
CREATE POLICY "Admins can view activity log stats" ON activity_log_stats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "System can manage activity log stats" ON activity_log_stats
    FOR ALL WITH CHECK (true); -- Allow system operations

-- Activity Log Retention Policies
CREATE POLICY "Admins can view retention policies" ON activity_log_retention_policies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can manage retention policies" ON activity_log_retention_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Activity Log Exports Policies
CREATE POLICY "Users can view their own exports" ON activity_log_exports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all exports" ON activity_log_exports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Users can create exports" ON activity_log_exports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

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
