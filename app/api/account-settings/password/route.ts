import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth-utils';
import { logAuditEvent } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PasswordChangeSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
}).refine((data) => data.new_password !== data.current_password, {
  message: "New password must be different from current password",
  path: ["new_password"],
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const body = await request.json();
    const validatedData = PasswordChangeSchema.parse(body);

    const supabaseAdmin = getSupabaseAdmin();
    // Verify current password
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: validatedData.current_password,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: validatedData.new_password }
    );

    if (updateError) {
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

    // Log audit event
    await logAuditEvent(
      user.id,
      'password_changed',
      'account_settings',
      user.id,
      { password_changed_at: new Date().toISOString() },
      request
    );

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
