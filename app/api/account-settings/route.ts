import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-utils';
import { logAuditEvent } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';

// Validation schemas
const NotificationPreferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  sms_notifications: z.boolean().optional(),
  phone_number: z.string().optional().nullable(),
  mention_notifications: z.boolean(),
  post_approval_notifications: z.boolean(),
  analytics_notifications: z.boolean(),
  security_notifications: z.boolean(),
  marketing_emails: z.boolean(),
  weekly_digest: z.boolean(),
  daily_summary: z.boolean(),
  digest_frequency: z.enum(['immediate', 'daily', 'weekly']).optional(),
}).refine(
  (data) => !data.sms_notifications || (data.phone_number && data.phone_number.trim().length > 0),
  { message: 'Phone number is required when SMS notifications are enabled', path: ['phone_number'] }
);

const SecuritySettingsSchema = z.object({
  two_factor_enabled: z.boolean(),
  login_notifications: z.boolean(),
  session_timeout_minutes: z.number().min(5).max(1440), // 5 minutes to 24 hours
  require_password_for_sensitive_actions: z.boolean(),
});

const AccountPreferencesSchema = z.object({
  language: z.string().min(2).max(10),
  timezone: z.string(),
  date_format: z.string(),
  time_format: z.enum(['12h', '24h']),
  theme: z.enum(['light', 'dark', 'system']),
  compact_mode: z.boolean(),
  auto_save_drafts: z.boolean(),
  default_post_visibility: z.enum(['public', 'private', 'team']),
});

const AccountSettingsUpdateSchema = z.object({
  notification_preferences: NotificationPreferencesSchema.optional(),
  security_settings: SecuritySettingsSchema.optional(),
  account_preferences: AccountPreferencesSchema.optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    // Get account settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('account_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Account settings fetch error:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch account settings' }, { status: 500 });
    }

    // When no row exists (PGRST116), return defaults so UI and card stay in sync
    const defaultNotificationPrefs = {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      phone_number: null as string | null,
      mention_notifications: true,
      post_approval_notifications: true,
      analytics_notifications: true,
      security_notifications: true,
      marketing_emails: false,
      weekly_digest: true,
      daily_summary: false,
      digest_frequency: 'immediate' as const,
    };
    const resolvedSettings = settings ?? {
      id: '',
      user_id: user.id,
      notification_preferences: defaultNotificationPrefs,
      security_settings: {
        two_factor_enabled: false,
        login_notifications: true,
        session_timeout_minutes: 60,
        require_password_for_sensitive_actions: true,
        failed_login_attempts: 0,
      },
      account_preferences: {
        language: 'en',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        theme: 'system',
        compact_mode: false,
        auto_save_drafts: true,
        default_post_visibility: 'public',
      },
      created_at: '',
      updated_at: '',
    };

    // Get active sessions
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('User sessions fetch error:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Format sessions data
    const formattedSessions = sessions?.map(session => ({
      id: session.id,
      user_id: session.user_id,
      ip_address: session.ip_address,
      user_agent: session.user_agent,
      created_at: session.created_at,
      last_activity: session.last_activity,
      is_current: session.id === user.session_id,
      location: session.location || null,
    })) || [];

    return NextResponse.json({
      settings: resolvedSettings,
      sessions: formattedSessions,
    });
  } catch (error) {
    console.error('Error fetching account settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const body = await request.json();
    const validatedData = AccountSettingsUpdateSchema.parse(body);

    const supabaseAdmin = getSupabaseAdmin();
    // Get existing settings
    const { data: existingSettings } = await supabaseAdmin
      .from('account_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Prepare update data
    const updateData: any = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (validatedData.notification_preferences) {
      updateData.notification_preferences = validatedData.notification_preferences;
    }

    if (validatedData.security_settings) {
      updateData.security_settings = validatedData.security_settings;
    }

    if (validatedData.account_preferences) {
      updateData.account_preferences = validatedData.account_preferences;
    }

    let result;
    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabaseAdmin
        .from('account_settings')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to update account settings' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new settings with defaults
      const defaultSettings = {
        notification_preferences: {
          email_notifications: true,
          push_notifications: true,
          sms_notifications: false,
          phone_number: null as string | null,
          mention_notifications: true,
          post_approval_notifications: true,
          analytics_notifications: true,
          security_notifications: true,
          marketing_emails: false,
          weekly_digest: true,
          daily_summary: false,
          digest_frequency: 'immediate' as const,
        },
        security_settings: {
          two_factor_enabled: false,
          login_notifications: true,
          session_timeout_minutes: 60,
          require_password_for_sensitive_actions: true,
          failed_login_attempts: 0,
        },
        account_preferences: {
          language: 'en',
          timezone: 'UTC',
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
          theme: 'system',
          compact_mode: false,
          auto_save_drafts: true,
          default_post_visibility: 'public',
        },
      };

      const { data, error } = await supabaseAdmin
        .from('account_settings')
        .insert({
          user_id: user.id,
          notification_preferences: { ...defaultSettings.notification_preferences, ...updateData.notification_preferences },
          security_settings: { ...defaultSettings.security_settings, ...updateData.security_settings },
          account_preferences: { ...defaultSettings.account_preferences, ...updateData.account_preferences },
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to create account settings' }, { status: 500 });
      }
      result = data;
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'account_settings_updated',
      'account_settings',
      result.id,
      { updated_fields: Object.keys(validatedData) },
      request
    );

    return NextResponse.json({ message: 'Account settings updated successfully', settings: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    console.error('Error updating account settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
