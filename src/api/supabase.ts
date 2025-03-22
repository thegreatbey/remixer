import { createClient } from '@supabase/supabase-js'
import type { Database as GeneratedDatabase } from '../types/supabase'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// Define auth states for better error handling
export type AuthState = {
  isConfigured: boolean;
  isGuest: boolean;
  error: string | null;
}

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

// Initialize auth state
export const getAuthState = (): AuthState => {
  const isConfigured = Boolean(supabaseUrl && supabaseKey)
  
  if (!isConfigured) {
    return {
      isConfigured: false,
      isGuest: true,
      error: 'Auth configuration missing - operating in limited guest mode'
    }
  }

  return {
    isConfigured: true,
    isGuest: false,
    error: null
  }
}

// Create client with enhanced error handling
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

// Add auth state change listener
supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  console.log('Auth state changed:', event, 
    session ? 'User session exists' : 'No user session')
  
  // Handle specific auth events
  switch (event) {
    case 'SIGNED_OUT':
      // Ensure clean logout per SOP
      localStorage.removeItem('supabase.auth.token')
      break;
    case 'SIGNED_IN':
      // Handle successful sign in
      break;
    case 'INITIAL_SESSION':
      // Don't show errors for initial session check
      break;
    default:
      // Log other auth events if they fail
      if (!session) {
        console.warn('Auth event without session:', event)
      }
  }
})

// Helper function to check if full features are available
export const hasFullFeatures = (): boolean => {
  const { isConfigured, isGuest } = getAuthState()
  return isConfigured && !isGuest
}

// Helper function to get appropriate error message
export const getAuthMessage = (): string | null => {
  const { error, isGuest } = getAuthState()
  if (error) {
    return isGuest 
      ? 'Some features are limited in guest mode' 
      : 'Authentication is currently unavailable'
  }
  return null
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
