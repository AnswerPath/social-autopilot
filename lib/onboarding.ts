export const ONBOARDING_STEPS = {
  WELCOME: 0,
  CONNECT_X: 1,
  FEATURE_INTRO: 2,
  COMPLETE: 3,
} as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS]
