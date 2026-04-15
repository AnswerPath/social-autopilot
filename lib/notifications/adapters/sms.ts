import twilio from 'twilio'
import type { ISmsAdapter } from '../types'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER

let twilioClient: ReturnType<typeof twilio> | null = null

function getTwilioClient(): ReturnType<typeof twilio> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
  }
  if (!twilioClient) {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  }
  return twilioClient
}

/**
 * SMS adapter using Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.
 */
async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('[notifications] SMS not configured (TWILIO_* env). Skipping send.', {
      to: to?.slice(0, 5) + '...'
    })
    return { success: false, error: 'SMS not configured' }
  }

  if (!TWILIO_FROM_NUMBER || TWILIO_FROM_NUMBER.trim().length === 0) {
    console.warn('[notifications] SMS not configured (TWILIO_FROM_NUMBER missing). Skipping send.', {
      to: to?.slice(0, 5) + '...'
    })
    return { success: false, error: 'SMS not configured (from number missing)' }
  }

  const trimmedTo = typeof to === 'string' ? to.trim() : ''
  if (!trimmedTo || trimmedTo.length < 8) {
    console.warn('[notifications] Invalid recipient phone, skipping send.', {
      to: trimmedTo ? trimmedTo.slice(0, 5) + '...' : ''
    })
    return { success: false, error: 'Invalid recipient phone' }
  }

  if (!body || body.trim().length === 0) {
    return { success: false, error: 'SMS body is empty' }
  }

  try {
    const client = getTwilioClient()
    const fromOrService = TWILIO_FROM_NUMBER.trim()
    const isMessagingServiceSid = fromOrService.startsWith('MG')
    const message = await client.messages.create({
      to: trimmedTo,
      body: body.trim(),
      ...(isMessagingServiceSid
        ? { messagingServiceSid: fromOrService }
        : { from: fromOrService })
    })

    if (message.sid) {
      return { success: true }
    }

    return { success: false, error: 'No SID returned from Twilio' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const toSanitized = trimmedTo.length > 6 ? trimmedTo.slice(0, 5) + '...' : trimmedTo
    console.error('[notifications] Twilio send failed', { to: toSanitized, message })
    return { success: false, error: message }
  }
}

export const smsAdapter: ISmsAdapter = {
  send: sendSms
}
