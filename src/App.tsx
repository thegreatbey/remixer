import { useState, useEffect } from 'react'
import { tweetsFromPost } from './api/claude'
import SavedTweets from './components/SavedTweets'
import { supabase } from './api/supabase'
import { User } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Tweet } from './types/types'
import TrendingHashtags from './components/TrendingHashtags'
//import type { Json } from './types/supabase'

// Add interface for tweet metrics
interface TweetMetrics {
  content: string;
  length: number;
  token_cost: number;
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
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [loadingDots, setLoadingDots] = useState('');

  useEffect(() => {
    console.log('useEffect triggered');
    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setShowAuth(false); // Close auth popup when session exists
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', { event, session });
      setUser(session?.user ?? null);
      if (session?.user) {
        setShowAuth(false);
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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

  // Add this useEffect to load saved tweets on auth change
  useEffect(() => {
    const loadSavedTweets = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('tweets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (data && !error) {
          setSavedTweets(data);
        }
      }
    };

    loadSavedTweets();
  }, [user]);  // This will run when user auth state changes

  // Add this useEffect for guest mode session cleanup
  useEffect(() => {
    if (!user) {  // Only for guest mode
      const handleUnload = () => {
        setSavedTweets([]);
        localStorage.removeItem('guestSavedTweets');  // If using local storage
      };
      
      window.addEventListener('unload', handleUnload);
      return () => window.removeEventListener('unload', handleUnload);
    }
  }, [user]);

  // Modify handleRemix to filter out invalid tweets
  const handleRemix = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedTweets = await tweetsFromPost(inputText, !!user);
      const validTweets = generatedTweets.filter((content: string) => content.length <= 280)
        .map((content: string, index: number) => ({
          id: `generated-${index}`,
          content,
          created_at: new Date().toISOString(),
          user_id: null,
          source_url: null,
          generated_tweets: null,
          generated_tweets_metrics: null,
          hashtags: null,
          input_length: null,
          input_token_cost: null,
          saved_tweet_length: null,
          saved_tweet_token_cost: null,
          user_input: null
        } as Tweet));
      
      if (validTweets.length === 0) {
        setError('No valid tweets generated (all exceeded 280 characters). Please try again.');
        return;
      }
      
      setTweets(validTweets);
      console.log('Debug: Calling trackActivity...');
      await trackActivity('generate');
    } catch (error) {
      console.error('Error remixing text:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate tweets');
    } finally {
      setIsLoading(false);
    }
  };

  const extractHashtags = (text: string | undefined): string[] => {
    if (!text) return [];  // Return empty array if text is undefined
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;  // Matches hashtags including Hebrew chars
    return text.match(hashtagRegex) || [];
  };
    // Modify handleSaveTweet to track saved tweet metrics
  const handleSaveTweet = async (tweet: Tweet) => {
    if (tweet?.content?.length > 280) {  // Added optional chaining here too
      setError('Tweet exceeds 280 characters and cannot be saved.');
      return;
    }
    
    try {
      const hashtags = extractHashtags(tweet?.content || "");  // Added fallback
      const generatedTweetsMetrics: TweetMetrics[] = tweets.map(tweet => ({
        content: tweet?.content || "", 
        length: tweet?.content?.length || 0,
        token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0
      }));

      const insertData = {
        content: tweet?.content || "",  // Null safety
        created_at: new Date().toISOString(),
        source_url: sourceUrl || null,
        user_id: user?.id || null,  // This handles guest mode (null user_id)
        user_input: inputText,
        input_length: inputText.length,
        input_token_cost: Math.ceil(inputText.length / 4),
        generated_tweets: JSON.stringify(tweets),  // Proper JSON serialization
        generated_tweets_metrics: JSON.stringify(generatedTweetsMetrics),  // Proper JSON serialization
        saved_tweet_length: tweet?.content?.length || 0,  // Null safety
        saved_tweet_token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0,  // Null safety
        hashtags: hashtags
      };

      const { data, error } = await supabase
        .from('tweets')
        .insert(insertData)
        .select();
      
      if (error) throw error;

      if (data && data[0]) {
        setSavedTweets(prev => [...prev, data[0]]);
        setIsPopoutVisible(true);
        await trackActivity('save');  // Add tracking here
      }
    } catch (error) {
      console.error('Error saving tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tweet');
    }
  };

  const handleClear = () => {
    resetState();  // Use the resetState function instead of individual setters
  };

  const handleDeleteTweet = async (tweet: Tweet) => {
    try {
      console.log('Deleting tweet:', tweet);
      
      const { error } = await supabase
        .from('tweets')
        .delete()
        .eq('id', tweet.id);  // Use tweet.id directly

      if (error) throw error;

      // Update local state
      setSavedTweets(prev => prev.filter(t => t.id !== tweet.id));

    } catch (error) {
      console.error('Error deleting tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tweet');
    }
  };

  // Add state reset function
  const resetState = () => {
    setTweets([]); // Clear generated tweets
    setError(null);
    setInputText(''); // Clear input
    setSourceUrl(''); // Clear source URL field
    setShowAuth(false); // Hide auth form
    
    // Only update visibility based on whether there are saved tweets
    if (user) {
      // For authenticated users - keep savedTweets intact
      setIsPopoutVisible(false);
    } else {
      // For guest users - keep session saved tweets intact
      setIsPopoutVisible(false);
    }
  };

  // Add this helper function
  const getRemainingCharacters = (content: string): number => {
    const urlLength = sourceUrl ? 25 : 0;  // URL counts as 25 if present
    return 280 - content.length - urlLength;
  };

  const trackActivity = async (event: 'generate' | 'save' = 'generate') => {
    try {
      if (event === 'generate') {
        const tweetsToTrack = tweets || [];
        const currentTime = new Date().toISOString();
        
        // Debug logging
        console.log('Activity Tracking Debug:', {
          tweetsToTrack,
          hashtags: tweetsToTrack.flatMap(t => extractHashtags(t.content || "")),
          totalTweets: tweetsToTrack.length,
          tokenCount: tweetsToTrack.reduce(
            (acc, t) => acc + (Math.ceil((t.content?.length || 0) / 4)),
            0
          )
        });

        const { data, error } = await supabase.from('activity').insert({
          access_timestamp: currentTime,
          created_at: currentTime,
          sign_in_time: currentTime,
          sign_out_time: null,
          session_duration: null,
          user_id: user?.id ?? undefined,
          source_url: sourceUrl ? sourceUrl.trim() : null,
          input_text: inputText?.trim() || null,
          generated_tweets: JSON.stringify(tweetsToTrack.map(t => ({
            content: t.content || '',
            length: t.content?.length || 0
          }))),
          saved_tweets: null,
          tweeted_tweets: null,
          hashtags_generated: tweetsToTrack.flatMap(t => extractHashtags(t.content || "")),
          hashtags_saved: null,
          total_tweets_generated: tweetsToTrack.length,
          total_tokens_spent: tweetsToTrack.reduce(
            (acc, t) => acc + (Math.ceil((t.content?.length || 0) / 4)),
            0
          ),
          tweet_lengths: tweetsToTrack.map(t => t.content?.length || 0)
        });

        // Log any errors
        if (error) {
          console.error('Activity Insert Error:', error);
        }
      } else if (event === 'save') {
        // Find and update existing record
        const { data: lastActivity } = await supabase
          .from('activity')
          .select('*')
          .eq('user_id', user?.id ?? undefined)
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastActivity?.[0]) {
          await supabase
            .from('activity')
            .update({
              saved_tweets: JSON.stringify(savedTweets),
              access_timestamp: new Date().toISOString(),
              hashtags_saved: savedTweets.flatMap(t => extractHashtags(t.content ? t.content : ""))
            })
            .eq('id', lastActivity[0].id);
        }
      }
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 pt-16">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold ml-[-16px]">Tweet Reply Generator</h1>
          <TrendingHashtags />
          {user ? (
            <a
              onClick={async () => {
                try {
                  const signOutTime = new Date().toISOString();
                  
                  // Find last activity record
                  const { data: lastActivity, error: fetchError } = await supabase
                    .from('activity')
                    .select('*')
                    .eq('user_id', user?.id ?? undefined)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (fetchError) {
                    console.error('Error fetching last activity:', fetchError);
                  }

                  // Update session timing if we found the record
                  if (lastActivity?.[0]) {
                    const signInTime = lastActivity[0].sign_in_time 
                      ? new Date(lastActivity[0].sign_in_time) 
                      : new Date();
                    const duration = new Date(signOutTime).getTime() - signInTime.getTime();
                    
                    const { error: updateError } = await supabase
                      .from('activity')
                      .update({
                        sign_out_time: signOutTime,
                        session_duration: Math.floor(duration / 1000)  // Duration in seconds
                      })
                      .eq('id', lastActivity[0].id);

                    if (updateError) {
                      console.error('Error updating activity:', updateError);
                    } else {
                      console.log('Session ended:', {
                        sign_out_time: signOutTime,
                        duration: Math.floor(duration / 1000)
                      });
                    }
                  }

                  // Sign out and reset state
                  await supabase.auth.signOut();
                  setInputText('');
                  setSourceUrl('');
                  setTweets([]);
                  setSavedTweets([]);
                  setError(null);
                  setIsPopoutVisible(false);
                } catch (error) {
                  console.error('Error during sign out:', error);
                }
              }}
              className="text-blue-500 hover:text-blue-600 cursor-pointer"
            >
              Sign Out
            </a>
          ) : (
            <a
              onClick={() => setShowAuth(true)}
              className="text-blue-500 hover:text-blue-600 cursor-pointer"
            >
              Sign In
            </a>
          )}
        </div>
        {/* Show Saved Tweets button for both auth and guest users */}
        {savedTweets.length > 0 && (
          <button
            onClick={() => setIsPopoutVisible(true)}
            className="absolute top-4 right-24 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Show Saved Tweets
          </button>
        )}
      </div>
      <div className="space-y-2 max-w-4xl mx-auto">
        <textarea
          className="w-full h-48 p-4 border rounded resize-none text-lg"
          placeholder="Type/paste your text here. I'll generate your tweets."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        
        {/* Source URL input - optional */}
        <input
          type="text"
          className="w-full p-2 border rounded text-lg"
          placeholder="Optional: Add source URL"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
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
              'Generate Tweets'
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
                'Generate Tweets'
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
        <div className="mt-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-4">Generated Tweets</h2>
          <SavedTweets 
            tweets={tweets} 
            onSaveTweet={handleSaveTweet}
            isSavedList={false}
            getRemainingCharacters={getRemainingCharacters}
            sourceUrl={sourceUrl}
          />
        </div>
      )}

      {/* Saved tweets sidebar */}
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
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Collapse
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto h-[calc(100%-73px)]">
            <SavedTweets 
              tweets={user ? savedTweets.filter(tweet => tweet.user_id === user.id) : savedTweets.filter(tweet => !tweet.user_id)}
              onDeleteTweet={handleDeleteTweet}
              isSavedList={true}
              getRemainingCharacters={getRemainingCharacters}
              sourceUrl={sourceUrl}
            />
          </div>
        </div>
      )}

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
    </div>
  )
}

export default App