#!/usr/bin/env node

/**
 * Demo Credentials Setup Script
 * 
 * This script sets up demo credentials for testing the Social Autopilot application
 * without requiring real Twitter API keys. It handles:
 * 1. Database table creation if needed
 * 2. Creating properly encrypted demo credentials
 * 3. Testing the setup
 */

import { createClient } from '@supabase/supabase-js'
import { createDemoCredentials } from '../lib/database-storage.js'

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

// Check environment variables
function checkEnvironment() {
  log('\n🔍 Checking environment configuration...', 'bright')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  
  log(`   Supabase URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`, supabaseUrl ? 'green' : 'red')
  log(`   Service Key: ${supabaseServiceKey ? '✅ Found' : '❌ Missing'}`, supabaseServiceKey ? 'green' : 'red')
  log(`   Anon Key: ${supabaseAnonKey ? '✅ Found' : '❌ Missing'}`, supabaseAnonKey ? 'green' : 'red')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    logError('Missing required environment variables!')
    logInfo('Please set the following environment variables:')
    logInfo('   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url')
    logInfo('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
    logInfo('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key (optional)')
    logInfo('\nYou can also create a .env.local file with these variables.')
    return false
  }
  
  return { supabaseUrl, supabaseServiceKey, supabaseAnonKey }
}

// Create database table if it doesn't exist
async function createDatabaseTable(supabase) {
  logStep('1', 'Checking database table structure...')
  
  try {
    // Check if table exists
    const { data, error } = await supabase
      .from('user_credentials')
      .select('id')
      .limit(1)
    
    if (!error) {
      logSuccess('Database table exists and is accessible')
      return true
    }
    
    if (error.message?.includes('relation "user_credentials" does not exist')) {
      logWarning('Database table does not exist. Creating it...')
      
      // Create the table using SQL
      const createTableSQL = `
        -- Create the credentials table with proper security
        CREATE TABLE IF NOT EXISTS user_credentials (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id TEXT NOT NULL,
            credential_type TEXT NOT NULL DEFAULT 'twitter',
            encrypted_api_key TEXT NOT NULL,
            encrypted_api_secret TEXT NOT NULL,
            encrypted_access_token TEXT NOT NULL,
            encrypted_access_secret TEXT NOT NULL,
            encrypted_bearer_token TEXT,
            encryption_version INTEGER DEFAULT 1,
            is_valid BOOLEAN DEFAULT FALSE,
            last_validated TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, credential_type)
        );

        -- Create indexes for faster lookups
        CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_credentials_type ON user_credentials(credential_type);
        CREATE INDEX IF NOT EXISTS idx_user_credentials_valid ON user_credentials(is_valid);

        -- Create updated_at trigger function
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Create trigger for updated_at
        DROP TRIGGER IF EXISTS update_user_credentials_updated_at ON user_credentials;
        CREATE TRIGGER update_user_credentials_updated_at 
            BEFORE UPDATE ON user_credentials 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();

        -- Enable Row Level Security
        ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can only access their own credentials" ON user_credentials;
        DROP POLICY IF EXISTS "Allow all operations for demo" ON user_credentials;

        -- Create policy to allow all operations for demo (in production, use proper auth)
        CREATE POLICY "Allow all operations for demo" ON user_credentials
            FOR ALL USING (true);

        -- Grant necessary permissions
        GRANT ALL ON user_credentials TO authenticated;
        GRANT ALL ON user_credentials TO anon;
      `
      
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL })
      
      if (createError) {
        logError(`Failed to create table: ${createError.message}`)
        logInfo('Please run the SQL script manually in your Supabase SQL Editor:')
        logInfo('   Copy the SQL from scripts/create-credentials-table.sql')
        logInfo('   Execute it in your Supabase dashboard')
        return false
      }
      
      logSuccess('Database table created successfully')
      return true
    } else {
      logError(`Database error: ${error.message}`)
      return false
    }
  } catch (error) {
    logError(`Unexpected error: ${error.message}`)
    return false
  }
}

// Test database connection
async function testDatabaseConnection(supabase) {
  logStep('2', 'Testing database connection...')
  
  try {
    const { data, error } = await supabase
      .from('user_credentials')
      .select('count(*)')
      .limit(1)
    
    if (error && !error.message?.includes('relation "user_credentials" does not exist')) {
      logError(`Connection test failed: ${error.message}`)
      return false
    }
    
    logSuccess('Database connection successful')
    return true
  } catch (error) {
    logError(`Connection test error: ${error.message}`)
    return false
  }
}

// Create demo credentials
async function setupDemoCredentials() {
  logStep('3', 'Creating demo credentials...')
  
  try {
    const result = await createDemoCredentials()
    
    if (result.success) {
      logSuccess('Demo credentials created successfully')
      logInfo('Demo credentials:')
      logInfo('   User ID: demo-user')
      logInfo('   API Key: demo_api_key_12345')
      logInfo('   API Secret: demo_api_secret_67890')
      logInfo('   Access Token: demo_access_token_abcde')
      logInfo('   Access Secret: demo_access_secret_fghij')
      return true
    } else {
      logError(`Failed to create demo credentials: ${result.error}`)
      return false
    }
  } catch (error) {
    logError(`Unexpected error creating demo credentials: ${error.message}`)
    return false
  }
}

// Test the demo credentials
async function testDemoCredentials(supabase) {
  logStep('4', 'Testing demo credentials...')
  
  try {
    const { data, error } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('user_id', 'demo-user')
      .eq('credential_type', 'twitter')
      .single()
    
    if (error) {
      logError(`Failed to retrieve demo credentials: ${error.message}`)
      return false
    }
    
    if (!data) {
      logError('Demo credentials not found in database')
      return false
    }
    
    // Check that encrypted data exists
    if (!data.encrypted_api_key || data.encrypted_api_key.length < 20) {
      logError('Invalid encrypted data detected')
      return false
    }
    
    logSuccess('Demo credentials found and properly encrypted')
    logInfo(`   Credential ID: ${data.id}`)
    logInfo(`   Created: ${new Date(data.created_at).toLocaleString()}`)
    logInfo(`   Valid: ${data.is_valid}`)
    return true
  } catch (error) {
    logError(`Error testing demo credentials: ${error.message}`)
    return false
  }
}

// Main setup function
async function main() {
  log('🎭 Social Autopilot Demo Credentials Setup', 'bright')
  log('==========================================', 'bright')
  
  // Check environment
  const env = checkEnvironment()
  if (!env) {
    process.exit(1)
  }
  
  // Initialize Supabase client
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  // Create database table if needed
  const tableCreated = await createDatabaseTable(supabase)
  if (!tableCreated) {
    logError('Failed to create database table')
    process.exit(1)
  }
  
  // Test database connection
  const connectionOk = await testDatabaseConnection(supabase)
  if (!connectionOk) {
    logError('Database connection test failed')
    process.exit(1)
  }
  
  // Create demo credentials
  const credentialsCreated = await setupDemoCredentials()
  if (!credentialsCreated) {
    logError('Failed to create demo credentials')
    process.exit(1)
  }
  
  // Test demo credentials
  const credentialsTested = await testDemoCredentials(supabase)
  if (!credentialsTested) {
    logError('Failed to test demo credentials')
    process.exit(1)
  }
  
  // Success!
  log('\n🎉 Demo credentials setup completed successfully!', 'green')
  log('\n📝 Next steps:', 'cyan')
  log('   1. Start your development server: npm run dev')
  log('   2. Navigate to Settings → Twitter API')
  log('   3. The demo credentials should now be available')
  log('   4. You can test posting without real Twitter API keys')
  
  log('\n🔧 Troubleshooting:', 'cyan')
  log('   • If you still see credential errors, try refreshing the page')
  log('   • Check the browser console for any additional error messages')
  log('   • Verify your Supabase environment variables are correct')
  
  log('\n✨ Happy testing!', 'magenta')
}

// Run the setup
main().catch((error) => {
  logError(`Setup failed: ${error.message}`)
  console.error(error)
  process.exit(1)
})
