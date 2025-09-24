import { getSupabaseAdmin } from './lib/supabase.ts'

async function testRegistration() {
  console.log('🧪 Testing registration process...')
  
  const supabase = getSupabaseAdmin()
  
  try {
    // Step 1: Check if user exists
    console.log('📝 Step 1: Checking if user exists...')
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(user => user.email === 'testuser123@example.com')
    console.log('✅ User check completed')
    
    if (existingUser) {
      console.log('⚠️  User already exists, skipping creation')
      return
    }
    
    // Step 2: Create user
    console.log('📝 Step 2: Creating user...')
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'testuser123@example.com',
      password: 'password123',
      email_confirm: true
    })
    
    if (error) {
      console.error('❌ User creation failed:', error)
      return
    }
    
    console.log('✅ User created:', data.user.id)
    
    // Step 3: Create profile
    console.log('📝 Step 3: Creating profile...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: data.user.id,
        first_name: 'Test',
        last_name: 'User123',
        display_name: 'TestUser123'
      })
      .select()
      .single()
    
    if (profileError) {
      console.error('❌ Profile creation failed:', profileError)
      return
    }
    
    console.log('✅ Profile created:', profile)
    
    // Step 4: Assign role
    console.log('📝 Step 4: Assigning role...')
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: data.user.id,
        role: 'VIEWER'
      })
    
    if (roleError) {
      console.error('❌ Role assignment failed:', roleError)
      return
    }
    
    console.log('✅ Role assigned')
    
    // Step 5: Create session
    console.log('📝 Step 5: Creating session...')
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    
    const { error: sessionError } = await supabase
      .from('user_sessions')
      .insert({
        session_id: sessionId,
        user_id: data.user.id,
        ip_address: '127.0.0.1',
        user_agent: 'test-script',
        last_activity: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true
      })
    
    if (sessionError) {
      console.error('❌ Session creation failed:', sessionError)
      return
    }
    
    console.log('✅ Session created')
    
    console.log('🎉 All steps completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testRegistration()
