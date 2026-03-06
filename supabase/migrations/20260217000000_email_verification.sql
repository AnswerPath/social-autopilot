-- Email verification (Option B: soft verification flag)
-- Add column to user_profiles and create token table for verification links

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
COMMENT ON COLUMN user_profiles.email_verified_at IS 'When the user verified their email via the verification link; null means not yet verified.';

CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

COMMENT ON TABLE email_verifications IS 'One-time tokens for email verification links; used_at set when link is clicked.';
