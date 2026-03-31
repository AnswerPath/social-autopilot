import { createClient } from '@supabase/supabase-js'

// Use environment variables with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

/** Decode `role` claim from a Supabase API JWT (anon / authenticated / service_role). */
function decodeSupabaseJwtRole(jwt: string): string | undefined {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return undefined
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      role?: string
    }
    return payload.role
  } catch {
    return undefined
  }
}

let loggedServiceKeyWarning = false

/**
 * Returns a user-facing message if the server key will cause RLS failures on admin writes
 * (e.g. anon key pasted into SUPABASE_SERVICE_ROLE_KEY). Otherwise null.
 */
export function getSupabaseServiceKeyMisconfigurationMessage(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || key === 'placeholder-service-key') {
    return (
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add the service_role secret from Supabase ' +
      '(Project Settings → API) to your server environment (e.g. Vercel). Do not use the anon key.'
    )
  }
  const role = decodeSupabaseJwtRole(key)
  if (role === 'anon' || role === 'authenticated') {
    return (
      `SUPABASE_SERVICE_ROLE_KEY is the "${role}" key. Use the service_role secret from Supabase ` +
      '(Project Settings → API). The anon/authenticated keys cannot insert into user_sessions and trigger row-level security errors.'
    )
  }
  if (role && role !== 'service_role') {
    return (
      `SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT (role claim: service_role). ` +
      `This key decodes as role "${role}".`
    )
  }
  return null
}

function warnIfServiceRoleKeyWrongForServer(): void {
  if (loggedServiceKeyWarning || supabaseServiceKey === 'placeholder-service-key') return
  const role = decodeSupabaseJwtRole(supabaseServiceKey)
  if (role === 'anon' || role === 'authenticated' || (role && role !== 'service_role')) {
    loggedServiceKeyWarning = true
    console.error(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY is not the service_role secret. Server writes hit RLS. ' +
        `Decoded JWT role: ${role ?? 'unknown'}. Fix in Vercel / .env (Project Settings → API in Supabase).`
    )
  }
}

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
    warnIfServiceRoleKeyWrongForServer()
    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminInstance;
}

/**
 * Fresh service-role client with no user session. Use for `user_sessions` (and similar) right
 * after `auth.signInWithPassword` / `refreshSession` on `getSupabaseAdmin()`: those calls set
 * the user JWT as the PostgREST Authorization header, so RLS runs as the user and inserts fail.
 * @see https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z
 */
export function createSupabaseServiceRoleClient() {
  warnIfServiceRoleKeyWrongForServer()
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
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
