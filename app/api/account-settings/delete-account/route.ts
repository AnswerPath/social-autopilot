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

const AccountDeletionSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const body = await request.json();
    const validatedData = AccountDeletionSchema.parse(body);

    const supabaseAdmin = getSupabaseAdmin();
    // Verify password
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password: validatedData.password,
    });

    if (signInError) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
    }

    // Log the deletion request first
    await logAuditEvent(
      user.id,
      'account_deletion_requested',
      'users',
      user.id,
      { 
        reason: validatedData.reason,
        feedback: validatedData.feedback,
        deletion_requested_at: new Date().toISOString(),
      },
      request
    );

    // Delete user data from related tables (in reverse dependency order).
    // Include user_credentials so X API, Twitter, Apify, and other credentials are removed.
    const tablesToDelete = [
      'audit_logs',
      'permission_audit_logs',
      'user_sessions',
      'account_settings',
      'user_profiles',
      'user_permissions',
      'user_credentials',
    ];

    for (const table of tablesToDelete) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        // Continue with other tables even if one fails
      }
    }

    // Delete the user account from Supabase Auth
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteUserError) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    // Clear auth cookies
    const response = NextResponse.json({ message: 'Account deleted successfully' });
    response.cookies.delete('auth-token');
    response.cookies.delete('session-id');

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    console.error('Error deleting account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
