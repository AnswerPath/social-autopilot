import { getSupabaseAdmin } from '@/lib/supabase'
import { emailAdapter } from '@/lib/notifications/adapters/email'

const VERIFICATION_EXPIRY_HOURS = 24
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

/**
 * Create a verification token for a user and send the verification email (Option B: soft verification).
 * Does not throw; logs and returns on failure so registration can still succeed.
 */
export async function sendVerificationEmailForUser(userId: string, email: string): Promise<void> {
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
    return
  }

  const verifyUrl = `${BASE_URL.replace(/\/$/, '')}/auth/verify-email?token=${token}`
  const subject = 'Verify your email - Social Autopilot'
  const body = `Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in ${VERIFICATION_EXPIRY_HOURS} hours. If you didn't create an account, you can ignore this email.`

  const result = await emailAdapter.send(email, subject, body)
  if (!result.success) {
    console.error('[email-verification] Failed to send email', { userId, error: result.error })
  }
}
