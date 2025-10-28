#!/usr/bin/env node

/**
 * Simple Demo Credentials Creation Script
 * 
 * This script creates demo credentials by calling the API endpoint
 */

import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
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

async function createDemoCredentials() {
  log('🎭 Creating demo credentials...', 'cyan')
  
  try {
    const response = await fetch('http://localhost:3000/api/setup/demo-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      logSuccess('Demo credentials created successfully!')
      logInfo('Demo credentials details:')
      logInfo('   User ID: demo-user')
      logInfo('   API Key: demo_api_key_12345')
      logInfo('   API Secret: demo_api_secret_67890')
      logInfo('   Access Token: demo_access_token_abcde')
      logInfo('   Access Secret: demo_access_secret_fghij')
      logInfo('   Bearer Token: demo_bearer_token_klmno')
      
      log('\n📝 Next steps:', 'cyan')
      log('   1. Go to Settings → Twitter API in your app')
      log('   2. You should now see the demo credentials listed')
      log('   3. Try creating a post to test the setup')
      
      return true
    } else {
      logError(`Failed to create demo credentials: ${data.error}`)
      if (data.details) {
        logInfo(`Details: ${data.details}`)
      }
      
      if (data.error?.includes('table') || data.error?.includes('does not exist')) {
        logWarning('The database table may not exist yet.')
        logInfo('Please run the database setup first:')
        logInfo('   npm run setup-database')
      }
      
      return false
    }
  } catch (error) {
    logError(`Connection failed: ${error.message}`)
    logWarning('Make sure the development server is running:')
    logInfo('   npm run dev')
    return false
  }
}

async function main() {
  log('🎭 Social Autopilot Demo Credentials Setup', 'bright')
  log('==========================================', 'bright')
  
  const success = await createDemoCredentials()
  
  if (success) {
    log('\n✨ Demo credentials setup completed!', 'green')
    log('You can now test the application without real Twitter API keys.', 'cyan')
  } else {
    log('\n❌ Demo credentials setup failed!', 'red')
    log('Please check the error messages above and try again.', 'yellow')
    process.exit(1)
  }
}

main().catch((error) => {
  logError(`Setup failed: ${error.message}`)
  console.error(error)
  process.exit(1)
})
