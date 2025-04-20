import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the entire app
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Check if environment variables are available
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase environment variables are missing. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment variables.",
  )
}

// Create a dummy client if credentials are missing
const isMissingCredentials = !supabaseUrl || !supabaseAnonKey

// Create a mock client with no-op methods if credentials are missing
const mockClient = {
  auth: {
    signInWithOAuth: async () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: null, error: null, subscription: { unsubscribe: () => {} } }),
    // Add other auth methods as needed
  },
  from: () => ({
    select: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    insert: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    update: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    upsert: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    delete: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    eq: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    single: () => ({ data: null, error: new Error("Supabase credentials not configured") }),
    // Add other query methods as needed
  }),
  // Add other Supabase client methods as needed
}

// Export either the real client or the mock client
export const supabase = isMissingCredentials ? (mockClient as any) : createClient(supabaseUrl, supabaseAnonKey)
