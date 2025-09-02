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

const RevokeSessionSchema = z.object({
  session_id: z.string().min(1, 'Session ID is required'),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    // Get all active sessions for the user
    const { data: sessions, error } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
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

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return createAuthError(AuthErrorType.UNAUTHORIZED, 'User not authenticated');
  }

  try {
    const body = await request.json();
    const validatedData = RevokeSessionSchema.parse(body);

    const supabaseAdmin = getSupabaseAdmin();
    // Verify the session belongs to the user
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('user_sessions')
      .select('*')
      .eq('id', validatedData.session_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 });
    }

    // Don't allow revoking the current session
    if (session.id === user.session_id) {
      return NextResponse.json({ error: 'Cannot revoke current session' }, { status: 400 });
    }

    // Revoke the session
    const { error: deleteError } = await supabaseAdmin
      .from('user_sessions')
      .delete()
      .eq('id', validatedData.session_id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'session_revoked',
      'user_sessions',
      validatedData.session_id,
      { 
        revoked_session_id: validatedData.session_id,
        revoked_session_ip: session.ip_address,
        revoked_session_user_agent: session.user_agent,
      },
      request
    );

    return NextResponse.json({ message: 'Session revoked successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    console.error('Error revoking session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
