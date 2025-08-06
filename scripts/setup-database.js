import { createClient } from '@supabase/supabase-js'

// Database setup script that works with v0's Supabase integration
async function setupDatabase() {
  console.log('🚀 Starting database setup...')
  console.log('🔍 Checking for v0 Supabase integration...')
  
  // Check for v0's automatically configured environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  
  console.log('📊 Environment check:')
  console.log(`   URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`)
  console.log(`   Service Key: ${supabaseServiceKey ? '✅ Found' : '❌ Missing'}`)
  console.log(`   Anon Key: ${supabaseAnonKey ? '✅ Found' : '❌ Missing'}`)
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('\n🤖 v0 Integration Status:')
    if (!supabaseUrl && !supabaseServiceKey) {
      console.log('   ✨ This appears to be running in v0 with Supabase integration')
      console.log('   📝 Environment variables should be automatically configured')
      console.log('   🔄 If you see this message, the integration may still be setting up')
    } else {
      console.log('   ⚠️  Partial configuration detected')
      console.log('   🛠️  Manual environment variable setup may be required')
    }
    
    console.log('\n📋 Next steps:')
    console.log('   1. If using v0: Environment variables should be automatic')
    console.log('   2. If running locally: Add variables to .env.local')
    console.log('   3. Try running the setup again in a few moments')
    return
  }
  
  console.log('✅ Supabase configuration found!')
  
  // Initialize Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  try {
    console.log('\n🧹 Step 1: Cleaning up any corrupted data...')
    
    // Delete any existing corrupted demo data
    const { error: deleteError } = await supabase
      .from('user_credentials')
      .delete()
      .eq('user_id', 'demo-user')
      .eq('credential_type', 'twitter')
    
    if (!deleteError) {
      console.log('✅ Corrupted demo data cleaned up')
    } else if (!deleteError.message?.includes('relation "user_credentials" does not exist')) {
      console.log('⚠️  Cleanup warning:', deleteError.message)
    } else {
      console.log('ℹ️  Table doesn\'t exist yet - will be created')
    }
    
    console.log('\n🔍 Step 2: Verifying table structure...')
    
    // Verify the table exists and has the correct structure
    const { data: tableInfo, error: verifyError } = await supabase
      .from('user_credentials')
      .select('id')
      .limit(1)
    
    if (!verifyError) {
      console.log('✅ Table verification successful')
      console.log(`📊 Current record count: ${tableInfo?.length || 0}`)
    } else if (verifyError.message?.includes('relation "user_credentials" does not exist')) {
      console.log('📋 Table needs to be created')
      console.log('\n🛠️  Manual setup required:')
      console.log('   1. Open your Supabase SQL Editor')
      console.log('   2. Copy and paste the SQL script from the app')
      console.log('   3. Execute the SQL commands')
      console.log('   4. Run this script again to verify')
      
      if (supabaseUrl) {
        const dashboardUrl = supabaseUrl.replace('/rest/v1', '') + '/project/_/sql'
        console.log(`   🔗 SQL Editor: ${dashboardUrl}`)
      }
      return
    } else {
      console.log('❌ Table verification failed:', verifyError.message)
      return
    }
    
    console.log('\n🎉 Database setup verification completed!')
    console.log('\n📝 Next steps:')
    console.log('   1. Go to Settings → Twitter API in your app')
    console.log('   2. The database should now show as "Healthy"')
    console.log('   3. Click "Create Demo Credentials" to add properly encrypted test data')
    console.log('   4. Or add your real Twitter API credentials')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    console.error('\n🔧 Troubleshooting:')
    console.error('   1. Verify your Supabase service role key has admin permissions')
    console.error('   2. Check that your Supabase project is active')
    console.error('   3. Try the manual SQL setup method in the app')
  }
}

// Test database connection
async function testConnection() {
  console.log('\n🔍 Testing database connection...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Cannot test connection - environment variables not configured')
    console.log('   This is normal if running in v0 before the integration is fully set up')
    return false
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // Simple connection test
    const { data, error } = await supabase
      .from('user_credentials')
      .select('count(*)')
      .limit(1)
    
    if (error && !error.message?.includes('relation "user_credentials" does not exist')) {
      console.error('❌ Connection test failed:', error.message)
      return false
    }
    
    console.log('✅ Database connection successful!')
    return true
  } catch (error) {
    console.error('❌ Connection test error:', error)
    return false
  }
}

// Main execution
async function main() {
  console.log('🗄️  Social Autopilot Database Setup')
  console.log('=====================================')
  console.log('🤖 v0 + Supabase Integration Support')
  console.log('=====================================\n')
  
  // Test connection first
  const connectionOk = await testConnection()
  
  if (!connectionOk) {
    console.log('\n⚠️  Connection test inconclusive, but continuing with setup...')
  }
  
  // Run setup
  await setupDatabase()
  
  console.log('\n✨ Setup process completed!')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (supabaseUrl) {
    console.log('\n🔗 Useful links:')
    console.log(`   • Supabase Dashboard: ${supabaseUrl.replace('/rest/v1', '')}/project/_/editor`)
    console.log('   • App Settings: http://localhost:3000 → Settings → Twitter API')
  }
}

// Run the setup
main().catch(console.error)
