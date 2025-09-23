import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-utils';
import { logAuditEvent } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';
import { PasswordChangeSchema } from '@/lib/password-validation';
import { withRateLimit, clearRateLimit } from '@/lib/rate-limiting';

export async function POST(request: NextRequest) {
  return withRateLimit('general')(request, async (req) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
    }

    try {
      const body = await req.json();
      const validatedData = PasswordChangeSchema.parse(body);

      const supabaseAdmin = getSupabaseAdmin();
      
      // Verify current password
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: user.email,
        password: validatedData.current_password,
      });

      if (signInError) {
        // Log failed password change attempt
        await logAuditEvent(
          user.id,
          'password_change_failed',
          'account_settings',
          user.id,
          { 
            reason: 'incorrect_current_password',
            attempted_at: new Date().toISOString() 
          },
          req
        );
        
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: validatedData.new_password }
      );

      if (updateError) {
        console.error('Password update error:', updateError);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
      }

      // Update last password change in account settings
      await supabaseAdmin
        .from('account_settings')
        .upsert({
          user_id: user.id,
          security_settings: {
            last_password_change: new Date().toISOString(),
            failed_login_attempts: 0,
          },
        }, {
          onConflict: 'user_id',
        });

      // Clear rate limit on successful password change
      clearRateLimit(req, 'general');

      // Log audit event
      await logAuditEvent(
        user.id,
        'password_changed',
        'account_settings',
        user.id,
        { password_changed_at: new Date().toISOString() },
        req
      );

      return NextResponse.json({ message: 'Password updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ 
          error: 'Invalid data format', 
          details: error.errors 
        }, { status: 400 });
      }
      console.error('Error changing password:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
