import { createClient } from '@supabase/supabase-js'
import type { Database as GeneratedDatabase } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// Debug environment variables
console.log('Environment variables available:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? 'exists' : 'missing',
  VITE_SUPABASE_KEY: import.meta.env.VITE_SUPABASE_KEY ? 'exists' : 'missing'
})

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

// Create client with fallback values to prevent initialization errors
export const supabase = createClient<GeneratedDatabase>(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public'
    }
  }
)

// Add a helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseKey)
}

export type Database = {
  public: {
    Tables: {
      activity: {
        Row: {
          id: string;
          created_at: string;
          access_timestamp: string;
          user_id: string | null;
          // ... other columns ...
        };
        Insert: {
          id?: string;
          created_at?: string;
          access_timestamp: string;
          user_id?: string | null;
          // ... other columns ...
        };
      };
      // ... other tables ...
    };
  };
};
