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
      
      // Check specifically for Claude service busy error
      // This ensures users get a clear message when the AI service is temporarily unavailable
      if (error instanceof Error && error.message.includes('temporarily busy')) {
        setError('Service is temporarily busy. Please try again in a few moments.');
      } else {
        // Handle all other types of errors with either the error message or default fallback
        setError(error instanceof Error ? error.message : 'Failed to generate tweets');
      }
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
        generated_tweets: {
          "tweets": tweets.map(t => ({
            content: t.content
          }))
        },
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
        const currentTime = new Date().toISOString();
        
        // Create metrics in the same format as in handleSaveTweet
        const metricsData = tweets.map(tweet => ({
          content: tweet?.content || "", 
          length: tweet?.content?.length || 0,
          token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0
        }));
        
        // Stringify the metrics data
        const metricsString = JSON.stringify(metricsData);
        console.log('Metrics string for activity:', metricsString);
        
        // Extract tweet lengths and hashtags for the activity table
        const tweetLengths = tweets.map(t => t?.content?.length || 0);
        const extractedHashtags = tweets.flatMap(t => extractHashtags(t.content));
        
        // Log the extracted hashtags
        console.log('Extracted hashtags for activity:', extractedHashtags);
        
        // Log whether this is a guest or authenticated user
        console.log('User status:', user ? 'Authenticated' : 'Guest');
        
        // Format the data exactly as it appears in working rows
        const activityData: any = {
          access_timestamp: currentTime,
          created_at: currentTime,
          // Only include sign_in_time for authenticated users
          ...(user?.id ? { sign_in_time: currentTime } : {}),
          user_id: user?.id || null, // Use null for guest users
          source_url: sourceUrl ? sourceUrl.trim() : null,
          input_text: inputText?.trim() || null,
          // Store the metrics as a JSON string
          generated_tweets_metrics: metricsString,
          total_tweets_generated: tweets.length || 0,
          // Store tweet lengths and hashtags in their respective columns
          tweet_lengths: tweetLengths,
          saved_tweets: { tweets: [] },
          hashtags_generated: extractedHashtags,
          total_tokens_spent: Math.ceil((inputText?.length || 0) / 4) || 0
        };

        // Debug logs
        console.log('=== Activity Tracking Debug ===');
        console.log('Event:', event);
        console.log('Activity Data:', JSON.stringify(activityData, null, 2));
        
        // Insert the activity data
        const { data, error } = await supabase
          .from('activity')
          .insert([activityData])
          .select()
          .single();

        if (error) {
          console.error('Supabase Error:', error);
          throw error;
        }

        console.log('Inserted Data:', data);
      } else if (event === 'save') {
        // Handle both authenticated and guest users
        // For guest users, we don't have user.id, but we still need to update the activity
        try {
          // Get the most recently saved tweet - this should be the one that was just saved
          const lastSavedTweet = savedTweets[savedTweets.length - 1];
          if (!lastSavedTweet) {
            console.error('No saved tweet found');
            return;
          }
          
          console.log('Last saved tweet:', lastSavedTweet);
          
          // Find the last activity record - for guest users, we need a different approach
          let lastActivity;
          
          if (user?.id) {
            // For authenticated users
            const { data } = await supabase
              .from('activity')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1);
              
            lastActivity = data;
          } else {
            // For guest users - find the most recent activity with null user_id
            const { data } = await supabase
              .from('activity')
              .select('*')
              .is('user_id', null)
              .order('created_at', { ascending: false })
              .limit(1);
              
            lastActivity = data;
          }
            
          if (!lastActivity || lastActivity.length === 0) {
            console.error('No activity record found');
            return;
          }
          
          console.log('Found activity record:', lastActivity[0]);
          
          // Extract hashtags from the saved tweet
          const hashtags = extractHashtags(lastSavedTweet.content || '');
          
          // Log the metrics data from the saved tweet
          console.log('Metrics from saved tweet:', lastSavedTweet.generated_tweets_metrics);
          
          // Create update data object
          const updateData: any = {
            hashtags_saved: hashtags
          };
          
          // Directly use the metrics from the saved tweet
          if (lastSavedTweet.generated_tweets_metrics) {
            updateData.generated_tweets_metrics = lastSavedTweet.generated_tweets_metrics;
            console.log('Adding metrics to update:', updateData.generated_tweets_metrics);
          } else {
            console.warn('No metrics found in saved tweet');
            
            // As a fallback, regenerate the metrics
            const generatedTweetsMetrics = tweets.map(tweet => ({
              content: tweet?.content || "", 
              length: tweet?.content?.length || 0,
              token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0
            }));
            
            updateData.generated_tweets_metrics = JSON.stringify(generatedTweetsMetrics);
            console.log('Using fallback metrics:', updateData.generated_tweets_metrics);
          }
          
          // Update the activity record
          console.log('Updating activity with:', updateData);
          const { error } = await supabase
            .from('activity')
            .update(updateData)
            .eq('id', lastActivity[0].id);
          
          if (error) {
            console.error('Error updating activity:', error);
          } else {
            console.log('Successfully updated activity with hashtags and metrics');
          }
        } catch (error) {
          console.error('Error in save activity tracking:', error);
        }
      }
    } catch (error) {
      console.error('Activity Tracking Error:', error);
      // Log the full error object for debugging
      console.error('Full error:', JSON.stringify(error, null, 2));
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