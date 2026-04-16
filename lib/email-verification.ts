import { getSupabaseAdmin } from '@/lib/supabase'
import { emailAdapter } from '@/lib/notifications/adapters/email'
import { getAppBaseUrl } from '@/lib/app-base-url'

export const VERIFICATION_EXPIRY_HOURS = 24

/**
 * Remove unused verification tokens for a user so only the latest link stays valid.
 */
async function deleteUnusedTokensForUser(
  userId: string,
  excludeTokenCreatedAt: string | Date
): Promise<void> {
  const excludeTokenCreatedAtIso =
    typeof excludeTokenCreatedAt === 'string'
      ? excludeTokenCreatedAt
      : excludeTokenCreatedAt.toISOString()
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('email_verifications')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null)
    .lt('created_at', excludeTokenCreatedAtIso)

  if (error) {
    console.error('[email-verification] Failed to clear pending tokens', { userId, error })
  }
}

/**
 * Create a verification token and send the verification email (Option B: soft verification).
 * Retires older unused tokens only after the new token is stored and the email sends successfully.
 */
export async function sendVerificationEmailForUser(
  userId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + VERIFICATION_EXPIRY_HOURS)

  const supabase = getSupabaseAdmin()
  const { data: insertedVerification, error: insertError } = await supabase
    .from('email_verifications')
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString()
    })
    .select('created_at')
    .single()

  if (insertError) {
    console.error('[email-verification] Failed to create verification record', { userId, error: insertError })
    return { success: false, error: 'Could not create verification' }
  }

  const verifyUrl = `${getAppBaseUrl()}/auth/verify-email?token=${token}`
  const subject = 'Verify your email - Social Autopilot'
  const body = `Please verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link expires in ${VERIFICATION_EXPIRY_HOURS} hours. If you didn't create an account, you can ignore this email.`

  const result = await emailAdapter.send(email, subject, body)
  if (!result.success) {
    console.error('[email-verification] Failed to send email', { userId, error: result.error })
    return { success: false, error: result.error ?? 'Email send failed' }
  }

  await deleteUnusedTokensForUser(userId, insertedVerification?.created_at ?? new Date().toISOString())
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
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000
  let matchedUserId: string | null = null
  let matchedUserEmail: string | null = null

  for (;;) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage
    })

    if (listError || !listData?.users) {
      console.error('[email-verification] listUsers failed for resend', listError)
      return { success: false }
    }

    const found = listData.users.find((u) => u.email?.toLowerCase() === normalized)
    if (found?.id) {
      matchedUserId = found.id
      matchedUserEmail = (found.email ?? normalized).trim().toLowerCase()
      break
    }

    if (listData.users.length < perPage) {
      return { success: true }
    }
    page += 1
  }

  if (!matchedUserId || !matchedUserEmail) {
    return { success: true }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email_verified_at')
    .eq('user_id', matchedUserId)
    .maybeSingle()

  if (profile?.email_verified_at) {
    return { success: true }
  }

  await sendVerificationEmailForUser(matchedUserId, matchedUserEmail)
  return { success: true }
}
