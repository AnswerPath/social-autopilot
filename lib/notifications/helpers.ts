import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Resolve user email by ID. Uses payloadEmail if provided and valid, otherwise fetches from auth.
 */
export async function resolveUserEmailById(
  userId: string,
  payloadEmail?: string | null
): Promise<string | null> {
  if (typeof payloadEmail === 'string' && payloadEmail.includes('@')) {
    return payloadEmail
  }
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId)
    if (!error && data?.user?.email) return data.user.email
  } catch {
    // ignore
  }
  return null
}

/**
 * Resolve recipient phone for SMS. Uses payload.phone if present and valid, else account_settings.
 */
export async function resolveRecipientPhone(
  recipientId: string,
  payload?: Record<string, unknown> | null
): Promise<string | null> {
  const fromPayload = payload?.phone
  if (typeof fromPayload === 'string' && fromPayload.trim().length > 0) {
    return fromPayload.trim()
  }
  try {
    const { data } = await getSupabaseAdmin()
      .from('account_settings')
      .select('notification_preferences')
      .eq('user_id', recipientId)
      .single()
    const prefs = data?.notification_preferences as { phone_number?: string | null } | null
    const phone = prefs?.phone_number
    if (typeof phone === 'string' && phone.trim().length > 0) return phone.trim()
  } catch {
    // ignore
  }
  return null
}
