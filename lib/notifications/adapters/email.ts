import { Resend } from 'resend'
import type { IEmailAdapter } from '../types'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM =
  process.env.RESEND_FROM ?? 'Social Autopilot <onboarding@resend.dev>'

/**
 * Email adapter using Resend. Requires RESEND_API_KEY.
 * Optional RESEND_FROM (e.g. "App Name <notifications@yourdomain.com>");
 * defaults to Resend's onboarding domain for testing.
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn(
      '[notifications] Email not configured (RESEND_API_KEY missing). Skipping send.',
      { to: to?.slice(0, 10) + '...' }
    )
    return { success: false, error: 'Email not configured' }
  }

  if (!to || !to.includes('@')) {
    console.warn('[notifications] Invalid recipient email, skipping send.', {
      to: to?.slice(0, 10) + '...'
    })
    return { success: false, error: 'Invalid recipient email' }
  }

  try {
    const resend = new Resend(RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject,
      text: body
    })

    if (error) {
      console.error('[notifications] Resend send failed', { to, error })
      return { success: false, error: error.message }
    }

    if (data?.id) {
      return { success: true }
    }

    return { success: false, error: 'No id returned from Resend' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[notifications] Resend exception', { to, message })
    return { success: false, error: message }
  }
}

export const emailAdapter: IEmailAdapter = {
  send: sendEmail
}
