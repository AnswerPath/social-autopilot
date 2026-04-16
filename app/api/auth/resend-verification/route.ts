import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth-utils'
import {
  resendVerificationForAuthenticatedUser,
  tryResendVerificationByEmail
} from '@/lib/email-verification'
import { withRateLimit } from '@/lib/rate-limiting'

const ResendEmailBodySchema = z.object({
  email: z.string().email('Invalid email address')
})

const OptionalEmailBodySchema = z.object({
  email: z.string().email().optional()
})

/**
 * POST /api/auth/resend-verification
 * - With session cookie: resends verification to the logged-in user's email (body ignored).
 * - Without session: JSON body { email } required; generic response for anti-enumeration.
 */
export async function POST(request: NextRequest) {
  return withRateLimit('resendVerification')(request, async (req) => {
    try {
      const user = await getCurrentUser(req)
      const raw = await req.json().catch(() => ({}))

      if (user) {
        const email = user.email ?? ''
        if (!email) {
          return NextResponse.json({ error: 'No email on account' }, { status: 400 })
        }
        const result = await resendVerificationForAuthenticatedUser(
          user.id,
          email,
          user.profile?.email_verified_at
        )
        if (!result.success) {
          const status = result.error === 'Email is already verified' ? 400 : 500
          return NextResponse.json({ message: result.error }, { status })
        }
        return NextResponse.json({ message: 'Verification email sent.' })
      }

      const parsed = ResendEmailBodySchema.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'EMAIL_REQUIRED',
            message:
              'Enter your email below to receive a new verification link, or sign in and try again.'
          },
          { status: 400 }
        )
      }

      await tryResendVerificationByEmail(parsed.data.email)
      return NextResponse.json({
        message:
          'If an account exists for that email and it is not verified, a verification link has been sent.'
      })
    } catch (error) {
      console.error('[resend-verification]', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
