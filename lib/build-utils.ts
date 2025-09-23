// Utility function to check if we're in a build environment
export function isBuildEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV;
}

// Utility function to safely get Supabase client
export function getSupabaseClient() {
  if (isBuildEnvironment()) {
    // Return a mock client during build
    return {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }),
    };
  }
  
  // Import and return the real Supabase client
  const { supabase } = require('@/lib/supabase');
  return supabase;
}
