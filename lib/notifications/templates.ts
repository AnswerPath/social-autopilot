import { getSupabaseAdmin } from '@/lib/supabase'
import type { NotificationChannel } from './types'

export interface NotificationTemplate {
  id: string
  event_type: string
  notification_type: string
  channel: string
  locale: string
  subject: string | null
  body_template: string
}

/**
 * Replace {{varName}} in template with values from variables. Missing vars become empty string.
 */
export function renderTemplate(
  templateBody: string,
  variables: Record<string, string | number | undefined>
): string {
  return templateBody.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key]
    return value !== undefined && value !== null ? String(value) : ''
  })
}

/**
 * Get a template for the given event type, notification type, channel and locale.
 * Falls back to locale 'en' if the requested locale is not found.
 */
export async function getTemplate(
  eventType: string,
  notificationType: string,
  channel: NotificationChannel,
  locale: string = 'en'
): Promise<NotificationTemplate | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('event_type', eventType)
    .eq('notification_type', notificationType)
    .eq('channel', channel)
    .eq('locale', locale)
    .maybeSingle()

  if (error) {
    console.error('[notifications] getTemplate failed', error)
    return null
  }

  if (data) return data as NotificationTemplate

  if (locale !== 'en') {
    const { data: enData, error: enError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('event_type', eventType)
      .eq('notification_type', notificationType)
      .eq('channel', channel)
      .eq('locale', 'en')
      .maybeSingle()
    if (enError) {
      console.error('[notifications] getTemplate fallback (en) failed', enError)
    }
    return (enData as NotificationTemplate) ?? null
  }

  return null
}

/**
 * Build subject and body for a notification using the template and payload.
 */
export async function renderNotificationContent(
  eventType: string,
  notificationType: string,
  channel: NotificationChannel,
  payload: Record<string, unknown> | null,
  locale: string = 'en'
): Promise<{ subject: string; body: string }> {
  const template = await getTemplate(eventType, notificationType, channel, locale)
  const vars: Record<string, string | number | undefined> = {}
  if (payload) {
    for (const [k, v] of Object.entries(payload)) {
      if (v !== null && v !== undefined) vars[k] = typeof v === 'object' ? JSON.stringify(v) : (v as string | number)
    }
  }

  if (template) {
    const subject = template.subject ? renderTemplate(template.subject, vars) : notificationType
    const body = renderTemplate(template.body_template, vars)
    return { subject, body }
  }

  const fallbackBody = payload ? JSON.stringify(payload) : notificationType
  return { subject: notificationType.replace(/_/g, ' '), body: fallbackBody }
}
