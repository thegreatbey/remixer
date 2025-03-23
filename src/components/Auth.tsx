import { useState } from 'react';
import { supabase } from '../api/supabase';

interface AuthProps {
  onClose: () => void;
}

const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const signInTime = new Date();
    if (!validateActivityTimes(signInTime, null, null)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        console.log('Attempting signup...');
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setError('Check your email for the confirmation link!');
      } else {
        console.log('Attempting signin...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // Track sign-in activity
        const { error: activityError } = await supabase.from('activity').insert({
          // Timestamp fields
          access_timestamp: signInTime.toISOString(),
          created_at: signInTime.toISOString(),
          sign_in_time: signInTime.toISOString(),
          sign_out_time: null,
          session_duration: null,
          
          // User identification
          user_id: signInData.user?.id,
          source_url: window.location.href,
          
          // Tweet-related fields (null because no tweets yet)
          input_text: null,
          generated_tweets: null,
          saved_tweets: null,
          tweeted_tweets: null,
          hashtags: null,
          total_tweets_generated: null,
          total_tokens_spent: null,
          tweet_lengths: null
        });
        
        if (activityError) {
          console.error('Error tracking sign-in:', activityError);
          throw activityError;
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(error instanceof Error ? error.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setEmail('');
    setPassword('');
  };

  const validateActivityTimes = (signInTime: Date, signOutTime: Date | null, duration: number | null): boolean => {
    // Check sign in/out times
    if (signOutTime && signInTime && signOutTime <= signInTime) {
      console.error('Sign out must be after sign in');
      return false;
    }

    // Check duration
    if (duration !== null && duration < 0) {
      console.error('Session duration cannot be negative');
      return false;
    }

    return true;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-1 right-1 sm:top-4 sm:right-4 text-gray-500 hover:text-gray-700 text-xl font-bold p-1 sm:p-2"
          aria-label="Close"
        >
          ×
        </button>

        <div className="p-3 sm:p-6">
          <h2 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-6">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          
          {error && (
            <div className={`mb-2 sm:mb-4 p-2 sm:p-3 rounded text-xs sm:text-base ${
              error.includes('confirmation link') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-base text-gray-700 mb-1 sm:mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded text-sm sm:text-base"
                required
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-base text-gray-700 mb-1 sm:mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded text-sm sm:text-base"
                required
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50 text-sm sm:text-base font-medium"
            >
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <button
            onClick={toggleMode}
            className="w-full mt-2 sm:mt-4 text-blue-500 hover:text-blue-600 text-xs sm:text-base"
          >
            {mode === 'signin' 
              ? 'Need an account? Sign Up' 
              : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth; 