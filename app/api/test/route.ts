import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient, getSupabaseAdmin } from '@/lib/supabase'
import { isAdmin } from '@/lib/admin-auth'

/**
 * DB connectivity diagnostics. In production, admin session or ADMIN_RECOVERY_TOKEN only;
 * in development, open for local setup (still avoids returning raw Supabase payloads).
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && !(await isAdmin(request))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    console.log('🔍 Testing Supabase connection...')

    console.log('🔍 Testing user_profiles table...')
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (profilesError) {
      console.error('Test endpoint user_profiles:', profilesError)
      return NextResponse.json({ error: 'user_profiles check failed' }, { status: 500 })
    }

    console.log('🔍 Testing user_roles table...')
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('id')
      .limit(1)

    if (rolesError) {
      console.error('Test endpoint user_roles:', rolesError)
      return NextResponse.json({ error: 'user_roles check failed' }, { status: 500 })
    }

    console.log('🔍 Testing user_sessions table...')
    const { data: sessions, error: sessionsError } = await createSupabaseServiceRoleClient()
      .from('user_sessions')
      .select('id')
      .limit(1)

    if (sessionsError) {
      console.error('Test endpoint user_sessions:', sessionsError)
      return NextResponse.json({ error: 'user_sessions check failed' }, { status: 500 })
    }

    console.log('🔍 Testing account_settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('account_settings')
      .select('id')
      .limit(1)

    if (settingsError) {
      console.error('Test endpoint account_settings:', settingsError)
      return NextResponse.json({ error: 'account_settings check failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All database tables are accessible',
      tables: {
        user_profiles: profiles ? 'accessible' : 'error',
        user_roles: roles ? 'accessible' : 'error',
        user_sessions: sessions ? 'accessible' : 'error',
        account_settings: settings ? 'accessible' : 'error',
      },
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
