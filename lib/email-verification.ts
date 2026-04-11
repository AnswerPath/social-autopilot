import { getSupabaseAdmin } from '@/lib/supabase'
import { emailAdapter } from '@/lib/notifications/adapters/email'

export const VERIFICATION_EXPIRY_HOURS = 24

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function appBaseUrl(): string {
  return BASE_URL.replace(/\/$/, '')
}

/**
 * Remove unused verification tokens for a user so only the latest link stays valid.
 */
async function deleteUnusedTokensForUser(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('email_verifications')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null)

  if (error) {
    console.error('[email-verification] Failed to clear pending tokens', { userId, error })
  }
}

/**
 * Create a verification token and send the verification email (Option B: soft verification).
 * Clears any prior unused tokens for this user first.
 */
export async function sendVerificationEmailForUser(
  userId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  await deleteUnusedTokensForUser(userId)

  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS)

  const supabase = getSupabaseAdmin()
  const { error: insertError } = await supabase.from('email_verifications').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString()
  })

  if (insertError) {
    console.error('[email-verification] Failed to create verification record', { userId, error: insertError })
    return { success: false, error: 'Could not create verification' }
  }

  const verifyUrl = `${appBaseUrl()}/auth/verify-email?token=${token}`
  const subject = 'Verify your email - Social Autopilot'
  const body = `Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in ${VERIFICATION_EXPIRY_HOURS} hours. If you didn't create an account, you can ignore this email.`

  const result = await emailAdapter.send(email, subject, body)
  if (!result.success) {
    console.error('[email-verification] Failed to send email', { userId, error: result.error })
    return { success: false, error: result.error ?? 'Email send failed' }
  }

  return { success: true }
}

/**
 * Resend verification for a logged-in user. Returns an error message if already verified or send fails.
 */
export async function resendVerificationForAuthenticatedUser(
  userId: string,
  email: string,
  emailVerifiedAt: string | null | undefined
): Promise<{ success: boolean; error?: string }> {
  if (emailVerifiedAt) {
    return { success: false, error: 'Email is already verified' }
  }
  return sendVerificationEmailForUser(userId, email)
}

/**
 * Resend verification by email (unauthenticated). Uses generic success messaging for anti-enumeration.
 */
export async function tryResendVerificationByEmail(email: string): Promise<{ success: boolean }> {
  const supabase = getSupabaseAdmin()
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  if (listError || !listData?.users) {
    console.error('[email-verification] listUsers failed for resend', listError)
    return { success: true }
  }

  const authUser = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser?.id) {
    return { success: true }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email_verified_at')
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (profile?.email_verified_at) {
    return { success: true }
  }

  await sendVerificationEmailForUser(authUser.id, email)
  return { success: true }
}
