import { useState } from 'react'
import { supabase } from '../../api/supabase'

interface SignUpProps {
  switchView: () => void
}

const SignUp = ({ switchView }: SignUpProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const signInTime = new Date().toISOString();
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;

      // Create activity record with sign-up/sign-in time
      const { error: activityError } = await supabase.from('activity').insert({
        access_timestamp: signInTime,
        created_at: signInTime,
        sign_in_time: signInTime,  // Set the initial sign-in time
        sign_out_time: null,       // Will be set on sign-out
        session_duration: null,     // Will be calculated on sign-out
        user_id: signUpData.user?.id,
        source_url: window.location.href,
        input_text: null,
        generated_tweets: null,
        saved_tweets: null,
        tweeted_tweets: null,
        hashtags_generated: null,
        hashtags_saved: null,
        total_tweets_generated: null,
        total_tokens_spent: null,
        tweet_lengths: null
      });

      if (activityError) {
        console.error('Error creating activity record:', activityError);
      }

      // Show success message or automatically switch to login
      switchView()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Sign Up</h2>
      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          {loading ? 'Loading...' : 'Sign Up'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        Already have an account?{' '}
        <button onClick={switchView} className="text-blue-600 hover:text-blue-500">
          Login
        </button>
      </p>
    </div>
  )
}

export default SignUp
