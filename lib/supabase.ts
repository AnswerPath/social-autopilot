import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Check if we're using placeholder values
const isUsingPlaceholders = supabaseUrl === 'https://placeholder.supabase.co' || 
                           supabaseServiceKey === 'placeholder-service-key' || 
                           supabaseAnonKey === 'placeholder-anon-key'

// Singleton pattern to prevent multiple client instances
let supabaseAdminInstance: any = null;
let supabaseClientInstance: any = null;

// Function to get Supabase admin client (for server-side operations)
export function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminInstance;
}

// Server-side client with service role key for admin operations
export const supabaseAdmin = getSupabaseAdmin();

// Client-side client for user operations (singleton)
export const supabase = (() => {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClientInstance;
})();

// Mock client for testing when Supabase is not configured
export const createMockSupabaseClient = () => {
  return {
    auth: {
      signUp: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null }),
      signInWithPassword: async () => ({ 
        data: { 
          user: { id: 'mock-user-id', email: 'test@example.com' },
          session: { access_token: 'mock-token', expires_at: Date.now() + 3600000 }
        }, 
        error: null 
      }),
      signOut: async () => ({ error: null }),
      admin: {
        createUser: async () => ({ data: { user: { id: 'mock-user-id', email: 'test@example.com' } }, error: null }),
        listUsers: async () => ({ users: [] }),
        updateUserById: async () => ({ error: null }),
        deleteUser: async () => ({ error: null })
      }
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: async () => ({ data: null, error: null }) }),
      update: () => ({ eq: () => ({ select: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      upsert: () => ({ select: async () => ({ data: null, error: null }) })
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({ data: { signedUrl: 'mock-url', token: 'mock-token' }, error: null }),
        remove: async () => ({ error: null })
      })
    }
  }
}

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
