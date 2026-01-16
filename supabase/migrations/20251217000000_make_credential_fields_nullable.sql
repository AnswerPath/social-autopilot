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

