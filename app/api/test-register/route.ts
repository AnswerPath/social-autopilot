import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, first_name, last_name } = body

    console.log('🧪 Testing registration step by step...')

    // Step 1: Check if user exists
    console.log('📝 Step 1: Checking if user exists...')
    const { data: existingUsers } = await getSupabaseAdmin().auth.admin.listUsers()
    const existingUser = existingUsers.users.find(user => user.email === email)
    
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }
    console.log('✅ User does not exist')

    // Step 2: Create user
    console.log('📝 Step 2: Creating user...')
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (error) {
      console.error('❌ User creation failed:', error)
      return NextResponse.json({ error: `User creation failed: ${error.message}` }, { status: 500 })
    }

    console.log('✅ User created:', data.user.id)

    // Step 3: Create profile
    console.log('📝 Step 3: Creating profile...')
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('user_profiles')
      .insert({
        user_id: data.user.id,
        first_name,
        last_name,
        display_name: `${first_name} ${last_name}`
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Profile creation failed:', profileError)
      return NextResponse.json({ error: `Profile creation failed: ${profileError.message}` }, { status: 500 })
    }

    console.log('✅ Profile created')

    // Step 4: Assign role
    console.log('📝 Step 4: Assigning role...')
    const { error: roleError } = await getSupabaseAdmin()
      .from('user_roles')
      .upsert({
        user_id: data.user.id,
        role: 'VIEWER'
      }, {
        onConflict: 'user_id'
      })

    if (roleError) {
      console.error('❌ Role assignment failed:', roleError)
      return NextResponse.json({ error: `Role assignment failed: ${roleError.message}` }, { status: 500 })
    }

    console.log('✅ Role assigned')

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        profile
      }
    })

  } catch (error) {
    console.error('❌ Test registration failed:', error)
    return NextResponse.json({ 
      error: 'Test registration failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
