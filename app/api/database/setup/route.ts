import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSessionUserId } from '@/lib/require-session-user'
import { isAdmin } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    let targetUserIdFromBody: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.targetUserId === 'string' && body.targetUserId.trim()) {
        targetUserIdFromBody = body.targetUserId.trim()
      }
    } catch {
      // Empty or invalid JSON body — optional for setup
    }

    const auth = await requireSessionUserId(request)
    const userId = auth.ok ? auth.userId : targetUserIdFromBody

    console.log('🚀 Starting database setup via API...')

    let cleanupCompleted = false
    if (userId) {
      console.log('🧹 Cleaning up corrupted data...')
      const { error: deleteError } = await supabaseAdmin
        .from('user_credentials')
        .delete()
        .eq('user_id', userId)
        .eq('credential_type', 'twitter')

      if (deleteError && !deleteError.message.includes('relation "user_credentials" does not exist')) {
        console.error('Delete error:', deleteError)
      } else {
        cleanupCompleted = true
      }
    } else {
      console.log(
        '🧹 Skipping per-user Twitter credentials cleanup (no session user and no targetUserId in body)'
      )
    }

    // Step 2: Try to create the table structure
    console.log('📋 Setting up table structure...')

    // Since we can't execute DDL directly, we'll verify the table exists
    const { error: tableError } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .limit(1)

    if (tableError && tableError.message.includes('relation "user_credentials" does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'Database table does not exist. Please run the SQL script manually in Supabase SQL Editor.',
        instructions: [
          '1. Open your Supabase Dashboard',
          '2. Go to SQL Editor',
          '3. Copy and paste the contents of scripts/setup-database.sql',
          '4. Execute the SQL commands',
          '5. Return here and try again',
        ],
      }, { status: 400 })
    }

    // Step 3: Verify table structure and permissions
    console.log('🔍 Verifying database setup...')

    const { data: healthData, error: healthError } = await supabaseAdmin
      .from('user_credentials')
      .select('id, user_id, credential_type, created_at')
      .limit(5)

    if (healthError) {
      return NextResponse.json({
        success: false,
        error: `Database verification failed: ${healthError.message}`,
        suggestion: 'Please check your Supabase service role key and table permissions.',
      }, { status: 500 })
    }

    console.log('✅ Database setup verification completed')

    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      details: {
        tableExists: true,
        recordCount: healthData?.length || 0,
        cleanupCompleted,
      },
    })
  } catch (error: any) {
    console.error('Database setup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: `Setup failed: ${error.message}`,
        suggestion: 'Try running the SQL script manually in Supabase SQL Editor.',
      },
      { status: 500 }
    )
  }
}
