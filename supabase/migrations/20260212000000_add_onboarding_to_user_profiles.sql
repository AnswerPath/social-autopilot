-- Add onboarding and help preference columns to user_profiles
-- onboarding_step: 0=welcome, 1=connect_x, 2=feature_intro, 3=complete
-- onboarding_completed_at: set when user finishes onboarding
-- tutorial_completed_at: set when user completes the feature tour
-- show_contextual_tooltips: user preference for tooltips (23.4)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS show_contextual_tooltips BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_profiles.onboarding_step IS 'Current onboarding step: 0=welcome, 1=connect_x, 2=feature_intro, 3=complete';
COMMENT ON COLUMN user_profiles.onboarding_completed_at IS 'When the user completed onboarding';
COMMENT ON COLUMN user_profiles.tutorial_completed_at IS 'When the user completed the feature tour';
COMMENT ON COLUMN user_profiles.show_contextual_tooltips IS 'Whether to show contextual tooltips in the app';
