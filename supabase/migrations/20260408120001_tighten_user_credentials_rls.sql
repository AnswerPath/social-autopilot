-- Replace permissive demo policy on user_credentials with user-scoped RLS and revoke anon access.
-- Server code uses service_role (bypasses RLS). Authenticated clients only see their own rows.

BEGIN;

DROP POLICY IF EXISTS "Allow all operations for demo" ON user_credentials;
DROP POLICY IF EXISTS "Users can only access their own credentials" ON user_credentials;

CREATE POLICY "Users can read own credentials" ON user_credentials
    FOR SELECT USING ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can insert own credentials" ON user_credentials
    FOR INSERT WITH CHECK ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can update own credentials" ON user_credentials
    FOR UPDATE USING ((auth.uid())::text = (user_id)::text);
CREATE POLICY "Users can delete own credentials" ON user_credentials
    FOR DELETE USING ((auth.uid())::text = (user_id)::text);

REVOKE ALL ON user_credentials FROM anon;

COMMIT;
