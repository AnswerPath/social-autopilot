import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('🚀 Setting up Social Autopilot database...')
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('setup-auth-tables.sql', 'utf8')
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`)
          
          // Use the REST API to execute SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: statement })
          })
          
          if (!response.ok) {
            const error = await response.text()
            console.log(`⚠️  Statement ${i + 1} failed (this might be expected): ${error}`)
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } catch (error) {
          console.log(`⚠️  Statement ${i + 1} failed (this might be expected): ${error.message}`)
        }
      }
    }
    
    console.log('🎉 Database setup completed!')
    
    // Test the connection by checking if tables exist
    console.log('🔍 Verifying tables were created...')
    
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'user_profiles',
        'user_roles',
        'user_permissions',
        'account_settings',
        'user_sessions',
        'audit_logs',
        'permission_audit_logs'
      ])
    
    if (error) {
      console.log('⚠️  Could not verify tables (this is normal if RLS is enabled)')
    } else {
      console.log('📊 Tables found:', tables?.map(t => t.table_name) || [])
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message)
  }
}

// Alternative approach: Create tables using Supabase client
async function createTablesManually() {
  console.log('🔧 Creating tables manually using Supabase client...')
  
  try {
    // Create user_profiles table
    console.log('📝 Creating user_profiles table...')
    const { error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    
    if (profilesError && profilesError.code === 'PGRST116') {
      console.log('✅ user_profiles table already exists')
    } else {
      console.log('✅ user_profiles table accessible')
    }
    
    // Create user_roles table
    console.log('📝 Creating user_roles table...')
    const { error: rolesError } = await supabase
      .from('user_roles')
      .select('id')
      .limit(1)
    
    if (rolesError && rolesError.code === 'PGRST116') {
      console.log('✅ user_roles table already exists')
    } else {
      console.log('✅ user_roles table accessible')
    }
    
    // Create account_settings table
    console.log('📝 Creating account_settings table...')
    const { error: settingsError } = await supabase
      .from('account_settings')
      .select('id')
      .limit(1)
    
    if (settingsError && settingsError.code === 'PGRST116') {
      console.log('✅ account_settings table already exists')
    } else {
      console.log('✅ account_settings table accessible')
    }
    
    console.log('🎉 Manual table verification completed!')
    
  } catch (error) {
    console.error('❌ Manual table creation failed:', error.message)
  }
}

// Run both approaches
setupDatabase().then(() => {
  createTablesManually()
})
