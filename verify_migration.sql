-- Verify that the migration was applied successfully
-- Run this in Supabase SQL Editor to check if columns are now nullable

SELECT 
    column_name, 
    is_nullable,
    CASE 
        WHEN is_nullable = 'YES' THEN '✅ Nullable (Migration applied)'
        ELSE '❌ NOT NULL (Migration needed)'
    END as status
FROM information_schema.columns 
WHERE table_name = 'user_credentials' 
AND column_name IN ('encrypted_api_secret', 'encrypted_access_token', 'encrypted_access_secret')
ORDER BY column_name;

