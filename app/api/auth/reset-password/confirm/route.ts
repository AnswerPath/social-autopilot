import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';
import { PasswordResetConfirmSchema } from '@/lib/password-validation';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Confirm password reset with new password
 * POST /api/auth/reset-password/confirm
 */
export async function POST(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    try {
      const body = await req.json();
      const { token, new_password, confirm_password } = PasswordResetConfirmSchema.parse(body);

    const supabase = getSupabaseAdmin();

    // Verify the reset token and update password
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery'
    });

    if (error) {
      console.error('Password reset confirmation error:', error);
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Update security settings to reset failed login attempts
    await supabase
      .from('account_settings')
      .upsert({
        user_id: data.user.id,
        security_settings: {
          last_password_change: new Date().toISOString(),
          failed_login_attempts: 0,
        },
      }, {
        onConflict: 'user_id',
      });

    // Log audit event
    await logAuditEvent(
      data.user.id,
      'password_reset_completed',
      'auth',
      data.user.id,
      { 
        reset_completed_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      },
      req
    );

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid data format', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Password reset confirmation error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
