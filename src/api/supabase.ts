import { createClient } from '@supabase/supabase-js'
import type { Database as GeneratedDatabase } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

console.log('Supabase URL:', supabaseUrl)

export const supabase = createClient<GeneratedDatabase>(
  supabaseUrl,
  supabaseKey,
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
