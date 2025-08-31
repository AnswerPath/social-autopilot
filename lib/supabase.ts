import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Client-side client for user operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface DatabaseCredential {
  id: string
  user_id: string
  credential_type: string
  encrypted_api_key: string
  encrypted_api_secret: string
  encrypted_access_token: string
  encrypted_access_secret: string
  encrypted_bearer_token?: string
  encryption_version: number
  is_valid: boolean
  last_validated?: string
  created_at: string
  updated_at: string
}
