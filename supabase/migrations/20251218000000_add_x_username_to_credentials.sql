-- Add x_username field to user_credentials table
-- This allows users to manually enter their X username to avoid rate limit issues

ALTER TABLE user_credentials 
ADD COLUMN IF NOT EXISTS x_username TEXT;

-- Create index for faster lookups by username
CREATE INDEX IF NOT EXISTS idx_user_credentials_x_username ON user_credentials(x_username) WHERE x_username IS NOT NULL;

-- Add comment
COMMENT ON COLUMN user_credentials.x_username IS 'Manually entered X/Twitter username to avoid rate limit issues when fetching from X API';

