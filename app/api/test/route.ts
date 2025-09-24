import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    // Test 1: Check if we can connect to Supabase
    console.log('🔍 Testing Supabase connection...')
    
    // Test 2: Check if user_profiles table exists
    console.log('🔍 Testing user_profiles table...')
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    
    if (profilesError) {
      return NextResponse.json({ 
        error: 'user_profiles table error', 
        details: profilesError 
      }, { status: 500 })
    }
    
    // Test 3: Check if user_roles table exists
    console.log('🔍 Testing user_roles table...')
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('id')
      .limit(1)
    
    if (rolesError) {
      return NextResponse.json({ 
        error: 'user_roles table error', 
        details: rolesError 
      }, { status: 500 })
    }
    
    // Test 4: Check if user_sessions table exists
    console.log('🔍 Testing user_sessions table...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('user_sessions')
      .select('id')
      .limit(1)
    
    if (sessionsError) {
      return NextResponse.json({ 
        error: 'user_sessions table error', 
        details: sessionsError 
      }, { status: 500 })
    }
    
    // Test 5: Check if account_settings table exists
    console.log('🔍 Testing account_settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('account_settings')
      .select('id')
      .limit(1)
    
    if (settingsError) {
      return NextResponse.json({ 
        error: 'account_settings table error', 
        details: settingsError 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'All database tables are accessible',
      tables: {
        user_profiles: profiles ? 'accessible' : 'error',
        user_roles: roles ? 'accessible' : 'error',
        user_sessions: sessions ? 'accessible' : 'error',
        account_settings: settings ? 'accessible' : 'error'
      }
    })
    
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
