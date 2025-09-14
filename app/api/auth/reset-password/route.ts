import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { createAuthError } from '@/lib/auth-utils';
import { PasswordResetRequestSchema } from '@/lib/password-validation';
import { withRateLimit } from '@/lib/rate-limiting';

/**
 * Initiate password reset process
 * POST /api/auth/reset-password
 */
export async function POST(request: NextRequest) {
  return withRateLimit('passwordReset')(request, async (req) => {
    try {
      const body = await req.json();
      const { email } = PasswordResetRequestSchema.parse(body);

    const supabase = getSupabaseAdmin();

    // Check if user exists
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error checking user existence:', userError);
      return NextResponse.json(
        { error: 'Failed to process password reset request' },
        { status: 500 }
      );
    }

    const user = userData.users.find(u => u.email === email);
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate password reset token
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json(
        { error: 'Failed to send password reset email' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'password_reset_requested',
      'auth',
      user.id,
      { email, requested_at: new Date().toISOString() },
      req
    );

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid email address', details: error.errors },
          { status: 400 }
        );
      }

      console.error('Password reset request error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
