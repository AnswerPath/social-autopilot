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

