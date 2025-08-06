"use client"

// Check if we're in the v0 environment with auto-configured Supabase
export function getSupabaseConfig() {
  // In v0's Supabase integration, these should be automatically available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('🔍 Checking Supabase configuration...')
  console.log('URL available:', !!supabaseUrl)
  console.log('Anon key available:', !!supabaseAnonKey)
  console.log('Service key available:', !!supabaseServiceKey)
  
  // Check if we're in v0's integrated environment
  const isV0Integrated = !!(supabaseUrl && supabaseAnonKey && supabaseServiceKey)
  
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
    isV0Integrated,
    isConfigured: isV0Integrated
  }
}

// Auto-detect and provide helpful setup information
export function getSetupInstructions() {
  const config = getSupabaseConfig()
  
  if (config.isV0Integrated) {
    return {
      status: 'ready',
      message: '✅ Supabase is automatically configured via v0 integration',
      instructions: []
    }
  }
  
  const missing = []
  if (!config.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!config.supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  
  return {
    status: 'needs-setup',
    message: '⚠️ Supabase environment variables not found',
    instructions: [
      'If you\'re using v0, the Supabase integration should be automatic',
      'If running locally, add these to your .env.local file:',
      ...missing.map(key => `  ${key}=your_${key.toLowerCase()}_here`)
    ]
  }
}
