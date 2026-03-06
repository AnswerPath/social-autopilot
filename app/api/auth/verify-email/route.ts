import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Verify email from the link sent after registration (Option B: soft verification).
 * GET /api/auth/verify-email?token=...
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing verification token' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()

  const { data: row, error: fetchError } = await supabase
    .from('email_verifications')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (fetchError || !row) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired verification link' },
      { status: 400 }
    )
  }

  if (row.used_at) {
    return NextResponse.json(
      { success: true, message: 'Email was already verified' },
      { status: 200 }
    )
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json(
      { success: false, error: 'Verification link has expired' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  const { error: updateTokenError } = await supabase
    .from('email_verifications')
    .update({ used_at: now })
    .eq('id', row.id)

  if (updateTokenError) {
    console.error('[verify-email] Failed to mark token used', updateTokenError)
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    )
  }

  const { error: updateProfileError } = await supabase
    .from('user_profiles')
    .update({ email_verified_at: now })
    .eq('user_id', row.user_id)

  if (updateProfileError) {
    console.error('[verify-email] Failed to set email_verified_at', updateProfileError)
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { success: true, message: 'Email verified successfully' },
    { status: 200 }
  )
}
