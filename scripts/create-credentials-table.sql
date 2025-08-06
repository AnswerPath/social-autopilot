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

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_type ON user_credentials(credential_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credentials_updated_at 
    BEFORE UPDATE ON user_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy to ensure users can only access their own credentials
CREATE POLICY "Users can only access their own credentials" ON user_credentials
    FOR ALL USING (auth.uid()::text = user_id);

-- Grant necessary permissions
GRANT ALL ON user_credentials TO authenticated;
GRANT USAGE ON SEQUENCE user_credentials_id_seq TO authenticated;
