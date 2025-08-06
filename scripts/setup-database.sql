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

-- Clean up any existing demo data with invalid encryption
DELETE FROM user_credentials WHERE user_id = 'demo-user' AND credential_type = 'twitter';

-- Note: Demo credentials will be created via the API endpoint with proper encryption
-- This ensures they are encrypted using the same method as real credentials

-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_credentials' 
ORDER BY ordinal_position;
