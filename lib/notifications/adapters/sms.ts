import type { ISmsAdapter } from '../types'

/**
 * SMS adapter stub. When Twilio (or similar) is configured, implement send.
 * Otherwise logs and returns failure.
 */
async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    console.warn('[notifications] SMS not configured (TWILIO_* env). Skipping send.', { to: to?.slice(0, 5) + '...' })
    return { success: false, error: 'SMS not configured' }
  }

  try {
    // Optional: use Twilio client when added to project
    // const client = twilio(accountSid, authToken); await client.messages.create({ to, body, from: TWILIO_FROM })
    console.warn('[notifications] Twilio env present but no send implementation; treating as failed.', { to: to?.slice(0, 5) + '...' })
    return { success: false, error: 'SMS sender not implemented' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export const smsAdapter: ISmsAdapter = {
  send: sendSms
}
