import { useState, useEffect } from 'react'
import { tweetsFromPost } from './api/claude'
import SavedTweets from './components/SavedTweets'
import { supabase } from './api/supabase'
import { User } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Tweet } from './components/SavedTweets'

// Add interface for tweet metrics
interface TweetMetrics {
  content: string;
  length: number;
  token_cost: number;
}

// Add interface for Session
type integer = number;  // Add this before the Session interface

interface Session {
  id: string;
  user_id: string | null;
  is_guest: boolean;
  login_time: string;      // Correct for timestamptz
  logout_time?: string;    // Correct for timestamptz
  session_duration?: string;
  total_tweets_generated: integer;
  total_tweets_saved: integer;
  total_input_tokens: integer;
  total_output_tokens: integer;
}

const App = () => {
  const [user, setUser] = useState<User | null>(null)
  const [inputText, setInputText] = useState<string>('')
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isPopoutVisible, setIsPopoutVisible] = useState(false)
  const [savedTweets, setSavedTweets] = useState<Tweet[]>([])
  const [showAuth, setShowAuth] = useState(false)
  const [isFirstSave, setIsFirstSave] = useState(true)
  const [loadingDots, setLoadingDots] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    console.log('useEffect triggered');
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setShowAuth(false); // Close auth popup when session exists
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setShowAuth(false); // Close auth popup when auth state changes
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // When user logs in, fetch their saved tweets
  useEffect(() => {
    const fetchSavedTweets = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('tweets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tweets:', error);
          return;
        }

        if (data) {
          // Type assertion to ensure compatibility
          setSavedTweets(data as Tweet[]);
          setIsPopoutVisible(false);
          setIsFirstSave(false);
        }
      }
    };

    fetchSavedTweets();
  }, [user]);

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setLoadingDots(dots => dots.length >= 3 ? '' : dots + '.');
      }, 500);
      return () => clearInterval(interval);
    } else {
      setLoadingDots('');
    }
  }, [isLoading]);

  // Only show auth-required features when logged in
  const showAuthFeatures = !!user;

  // Helper function to validate tweet length
  const isValidTweetLength = (content: string) => content.length <= 280;

  // Add function to update session metrics
  const updateSessionMetrics = async (inputTokens: number, outputTokens: number, savedTweet: boolean = false) => {
    if (!currentSessionId) return;

    try {
      const { data: sessionData, error: fetchError } = await supabase
        .from('sessions')
        .select('total_tweets_generated, total_tweets_saved, total_input_tokens, total_output_tokens')
        .eq('id', currentSessionId)
        .single();

      if (fetchError) throw fetchError;
      if (!sessionData) return;

      const updates = {
        total_tweets_generated: (sessionData.total_tweets_generated || 0) + tweets.length,
        total_tweets_saved: (sessionData.total_tweets_saved || 0) + (savedTweet ? 1 : 0),
        total_input_tokens: (sessionData.total_input_tokens || 0) + inputTokens,
        total_output_tokens: (sessionData.total_output_tokens || 0) + outputTokens
      };

      const { error: updateError } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', currentSessionId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating session metrics:', error);
    }
  };

  // Modify handleRemix to track metrics
  const handleRemix = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedTweets = await tweetsFromPost(inputText, showAuthFeatures);
      const validTweets = generatedTweets
        .filter((content: string) => isValidTweetLength(content))
        .map((content: string, index: number) => ({
          id: `generated-${index}`,
          content,
          created_at: new Date().toISOString(),
          user_id: null
        }));
      
      if (validTweets.length === 0) {
        setError('No valid tweets generated (all exceeded 280 characters). Please try again.');
        return;
      }
      
      setTweets(validTweets);

      // Calculate and update metrics
      const inputTokens = Math.ceil(inputText.length / 4);
      const outputTokens = validTweets.reduce((total, tweet) => 
        total + Math.ceil(tweet.content.length / 4), 0);
      await updateSessionMetrics(inputTokens, outputTokens);

    } catch (error) {
      console.error('Error remixing text:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate tweets');
    } finally {
      setIsLoading(false);
    }
  };

  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;  // Matches hashtags including Hebrew chars
    return text.match(hashtagRegex) || [];
  };
    // Modify handleSaveTweet to track saved tweet metrics
  const handleSaveTweet = async (tweet: Tweet) => {
    try {
      const hashtags = extractHashtags(tweet.content);
      // Calculate metrics for all generated tweets
      const generatedTweetsMetrics: TweetMetrics[] = tweets.map(tweet => ({
        content: tweet.content, 
        length: tweet.content.length,
        token_cost: Math.ceil(tweet.content.length / 4)
      }));

      const { data, error } = await supabase
        .from('tweets')
        .insert([{ 
          content: tweet.content,
          user_id: user ? user.id : null,
          user_input: inputText,
          input_length: inputText.length,
          input_token_cost: Math.ceil(inputText.length / 4),
          generated_tweets: tweets,
          generated_tweets_metrics: generatedTweetsMetrics,
          saved_tweet_length: tweet.content.length,
          saved_tweet_token_cost: Math.ceil(tweet.content.length / 4),
          hashtags: hashtags //store array of hashtags
        }])
        .select();
      
      if (error) throw error;

      if (data && data[0]) {
        setSavedTweets(prev => [...prev, data[0]]);
        setIsPopoutVisible(true);
        
        // Update metrics for saved tweet
        const inputTokens = Math.ceil(inputText.length / 4);
        const outputTokens = Math.ceil(tweet.content.length / 4);
        await updateSessionMetrics(inputTokens, outputTokens, true);
      }
    } catch (error) {
      console.error('Error saving tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tweet');
    }
  };

  const handleClear = () => {
    resetState();  // Use the resetState function instead of individual setters
  };

  const handleDeleteTweet = async (tweet: any) => {  // Change parameter type temporarily to debug
    try {
      console.log('Deleting tweet:', tweet); // Debug log
      
      // Make sure we have the correct ID
      const tweetId = tweet.id || tweet;
      
      console.log('Using ID:', tweetId); // Debug log

      const { error } = await supabase
        .from('tweets')
        .delete()
        .eq('id', tweetId);

      if (error) throw error;

      // Update local state
      setSavedTweets(prev => prev.filter(t => t.id !== tweetId));

    } catch (error) {
      console.error('Error deleting tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tweet');
    }
  };

  // Add state reset function
  const resetState = () => {
    setTweets([]);
    setSavedTweets([]);
    setIsPopoutVisible(false);
    setIsFirstSave(true);
    setError(null);
    setInputText(''); // Clear input
    setShowAuth(false); // Hide auth form
  };

  // Initialize session when app loads
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .insert({
            user_id: user?.id || null,
            is_guest: !user,
            login_time: new Date().toISOString(),
            total_tweets_generated: 0,
            total_tweets_saved: 0,
            total_input_tokens: 0,
            total_output_tokens: 0
          } as Partial<Session>)
          .select()
          .single();

        if (error) throw error;
        setCurrentSessionId(sessionData?.id);
      } catch (error) {
        console.error('Error creating session:', error);
      }
    };

    initSession();

    // Cleanup on unmount or user change
    return () => {
      if (currentSessionId) {
        const endSession = async () => {
          const now = new Date();
          const { data: sessionData, error: fetchError } = await supabase
            .from('sessions')
            .select('login_time')
            .eq('id', currentSessionId)
            .single();

          if (fetchError) {
            console.error('Error fetching session:', fetchError);
            return;
          }

          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              logout_time: now.toISOString(),
              session_duration: `${Math.floor((now.getTime() - new Date(sessionData.login_time).getTime()) / 1000)} seconds`
            })
            .eq('id', currentSessionId);

          if (updateError) {
            console.error('Error updating session:', updateError);
          }
        };
        endSession();
      }
    };
  }, [user]); // Re-run when user auth state changes

  return (
    <div className="min-h-screen bg-gray-100 p-8 pt-16">
      <div className="max-w-4xl mx-auto">
        {/* Header section with Sign In/Out and benefits dropdown */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Tweet Reply Generator</h1>
          <div className="relative">
            <button 
              onClick={async () => {
                if (user) {
                  await supabase.auth.signOut();
                  // Reset all states to initial values
                  setTweets([]);
                  setSavedTweets([]);
                  setInputText('');
                  setIsLoading(false);
                  setError(null);
                  setIsPopoutVisible(false);
                  setIsFirstSave(true);
                } else {
                  setShowAuth(true);
                }
              }}
              className="text-blue-500 hover:text-blue-600 underline peer"
            >
              {user ? 'Sign Out' : 'Sign In'}
            </button>
            {!user && (
              <div className="absolute right-0 mt-1 w-56 py-2 bg-white rounded-lg shadow-xl opacity-0 invisible peer-hover:opacity-100 peer-hover:visible transition-opacity duration-200">
                <div className="px-4 py-1 text-sm font-medium text-gray-700">Account Benefits:</div>
                <div className="px-4 py-1 text-sm text-gray-600">{'>'}permanently save tweets</div>
                <div className="px-4 py-1 text-sm text-gray-600">{'>'}#hashtags</div>
                <div className="px-4 py-1 text-sm text-gray-600">{'>'}more tweet variations</div>
              </div>
            )}
          </div>
        </div>

        {/* Auth popup with dark overlay */}
        {showAuth && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-24 z-50">
            <div className="relative">
              <button 
                onClick={() => setShowAuth(false)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100"
              >
                ×
              </button>
              <Auth 
                supabaseClient={supabase}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: '#3B82F6',
                        brandAccent: '#2563EB',
                      }
                    }
                  },
                  style: {
                    container: {
                      backgroundColor: 'white',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                    },
                    button: {
                      backgroundColor: 'var(--colors-brand)',
                      color: 'white',
                      transition: 'background-color 0.2s',
                    },
                    input: {
                      backgroundColor: 'white',
                      color: 'black',
                    },
                  }
                }}
                providers={['github', 'google', 'azure']}
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <textarea
            className="w-full h-48 p-4 border rounded resize-none text-lg"
            placeholder="Type/paste your text here. I'll generate your tweets."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          
          {error && (
            <div className="text-red-500 text-sm mb-2">
              {error}
            </div>
          )}
          
          {tweets.length === 0 ? (
            <button
              onClick={handleRemix}
              disabled={isLoading || !inputText.trim()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg min-w-[150px]"
            >
              {isLoading ? (
                <span className="inline-block min-w-[80px]">
                  Generating{loadingDots}
                </span>
              ) : (
                'Generate tweets'
              )}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleRemix}
                disabled={isLoading || !inputText.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg min-w-[150px]"
              >
                {isLoading ? (
                  <span className="inline-block min-w-[80px]">
                    Generating{loadingDots}
                  </span>
                ) : (
                  'Generate tweets'
                )}
              </button>

              <button
                onClick={handleClear}
                className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600 text-lg font-medium"
              >
                Clear Everything
              </button>
            </div>
          )}
        </div>

        {/* Generated tweets section */}
        {tweets.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Generated Tweets</h2>
            <SavedTweets 
              tweets={tweets} 
              onSaveTweet={handleSaveTweet}
              isSavedList={false}
            />
          </div>
        )}
        
        {/* Show saved tweets button - appears for both guest and auth users after first collapse */}
        {savedTweets.length > 0 && !isPopoutVisible && !isFirstSave && (
          <button
            onClick={() => setIsPopoutVisible(true)}
            className="fixed top-4 right-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Show Saved Tweets
          </button>
        )}

        {/* Saved tweets sidebar - visible for both guest and auth users */}
        {savedTweets.length > 0 && (
          <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
            isPopoutVisible ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Saved Tweets</h2>
                <button 
                  onClick={() => {
                    setIsPopoutVisible(false);
                    setIsFirstSave(false);  // This enables the Show Saved Tweets button
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Collapse
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto h-[calc(100%-73px)]">
              <SavedTweets 
                tweets={savedTweets} 
                onDeleteTweet={handleDeleteTweet}
                isSavedList={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App