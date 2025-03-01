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
  // Add a session ID for guest users
  const [guestSessionId] = useState<string>(() => {
    // Generate a unique session ID for this browser session
    return 'guest-' + Math.random().toString(36).substring(2, 15);
  });
  // Track session tweets separately without affecting database operations
  const [sessionTweetIds, setSessionTweetIds] = useState<string[]>([]);

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

  // Modify the useEffect to handle guest session tweets properly
  useEffect(() => {
    const loadSavedTweets = async () => {
      if (user) {
        // For authenticated users - load tweets with their user_id
        const { data, error } = await supabase
          .from('tweets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (data && !error) {
          setSavedTweets(data);
        }
      } else {
        // For guest users - load tweets with null user_id
        const { data, error } = await supabase
          .from('tweets')
          .select('*')
          .is('user_id', null)
          .order('created_at', { ascending: false });
          
        if (data && !error) {
          setSavedTweets(data);
          // But we'll only show the ones from this session in the UI
        }
      }
    };

    loadSavedTweets();
  }, [user]);  // This will run when user auth state changes

  // Modify handleRemix to filter out invalid tweets
  const handleRemix = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedTweets = await tweetsFromPost(inputText, !!user);
      
      // Store ALL generated tweets before filtering, including metadata
      const allGeneratedTweetsData = {
        original_input: inputText,
        source_url: sourceUrl || null,
        timestamp: new Date().toISOString(),
        all_tweets: generatedTweets.map((content: string) => ({
          content,
          length: content.length,
          characters_remaining: 280 - content.length - (sourceUrl ? 25 : 0),
          hashtags: extractHashtags(content),
          is_valid: content.length <= 280
        }))
      };
      
      // Convert to JSON string for storage
      const allGeneratedTweetsJSON = JSON.stringify(allGeneratedTweetsData);
      console.log('All generated tweets data:', allGeneratedTweetsJSON);
      
      // Now filter for valid tweets as before
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
          user_input: null,
          all_generated_tweets: allGeneratedTweetsJSON // Add all generated tweets data
        } as Tweet));
      
      if (validTweets.length === 0) {
        setError('No valid tweets generated (all exceeded 280 characters). Please try again.');
        return;
      }
      
      setTweets(validTweets);
      console.log('Debug: Calling trackActivity...');
      
      // Create metrics for storage
      const generatedTweetsMetrics: TweetMetrics[] = validTweets.map(tweet => ({
        content: tweet?.content || "", 
        length: tweet?.content?.length || 0,
        token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0
      }));
      
      // Insert into public.tweets immediately with empty content
      // This makes all_generated_tweets the trigger instead of content
      const insertData = {
        content: "",  // Empty content since no tweet is explicitly saved yet
        created_at: new Date().toISOString(),
        source_url: sourceUrl || null,
        user_id: user?.id || null,
        user_input: inputText,
        input_length: inputText.length,
        input_token_cost: Math.ceil(inputText.length / 4),
        generated_tweets: {
          "tweets": validTweets.map(t => ({
            content: t.content
          }))
        },
        generated_tweets_metrics: JSON.stringify(generatedTweetsMetrics),
        saved_tweet_length: 0,  // No saved tweet yet
        saved_tweet_token_cost: 0,  // No saved tweet yet
        hashtags: [],  // No hashtags yet since no tweet is saved
        all_generated_tweets: allGeneratedTweetsJSON  // This is now the trigger
      };
      
      console.log('Inserting generated tweets data into public.tweets:', insertData);
      const { data, error } = await supabase
        .from('tweets')
        .insert(insertData)
        .select();
      
      if (error) {
        console.error('Error inserting generated tweets:', error);
      } else if (data && data[0]) {
        console.log('Successfully inserted generated tweets data, ID:', data[0].id);
        // For guest users, track this tweet ID in the session
        if (!user && data[0].id) {
          setSessionTweetIds(prev => [...prev, data[0].id]);
        }
      }
      
      // Pass the all_generated_tweets data to trackActivity
      await trackActivity('generate', allGeneratedTweetsJSON);
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
    // Modify handleSaveTweet to update existing record instead of creating a new one
  const handleSaveTweet = async (tweet: Tweet) => {
    if (tweet?.content?.length > 280) {  // Added optional chaining here too
      setError('Tweet exceeds 280 characters and cannot be saved.');
      return;
    }
    
    try {
      console.log('=== SAVE TWEET DEBUG ===');
      console.log('Tweet being saved:', tweet);
      console.log('Current user state:', user ? 'Authenticated' : 'Guest');
      console.log('User ID:', user?.id || 'null (guest mode)');
      console.log('Guest session ID:', guestSessionId);
      
      const hashtags = extractHashtags(tweet?.content || "");  // Added fallback
      console.log('Extracted hashtags:', hashtags);
      
      // Get the all_generated_tweets data from the tweet object if available
      const allGeneratedTweets = tweet.all_generated_tweets || null;
      console.log('All generated tweets data:', allGeneratedTweets);

      // First, try to find an existing record with this all_generated_tweets data
      let existingRecords: Tweet[] = [];
      let findError = null;
      
      if (allGeneratedTweets && typeof allGeneratedTweets === 'string') {
        // Only search if we have all_generated_tweets data as a string
        const result = await supabase
          .from('tweets')
          .select('*')
          .eq('all_generated_tweets', allGeneratedTweets)
          .eq('user_id', user?.id || null);
        
        existingRecords = result.data || [];
        findError = result.error;
      }
      
      if (findError) {
        console.error('Error finding existing record:', findError);
        throw findError;
      }
      
      console.log('Existing records found:', existingRecords);
      
      const updateData = {
        content: tweet?.content || "",  // Update with the saved tweet content
        saved_tweet_length: tweet?.content?.length || 0,
        saved_tweet_token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0,
        hashtags: hashtags
      };
      
      let data;
      let error;
      
      if (existingRecords && existingRecords.length > 0) {
        // Update the existing record
        console.log('Updating existing record with ID:', existingRecords[0].id);
        const result = await supabase
          .from('tweets')
          .update(updateData)
          .eq('id', existingRecords[0].id)
          .select();
          
        data = result.data;
        error = result.error;
      } else {
        // If no existing record found (fallback), create a new one
        console.log('No existing record found, creating new one');
        
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
          generated_tweets_metrics: JSON.stringify(generatedTweetsMetrics),
          saved_tweet_length: tweet?.content?.length || 0,
          saved_tweet_token_cost: tweet?.content ? Math.ceil(tweet.content.length / 4) : 0,
          hashtags: hashtags,
          all_generated_tweets: allGeneratedTweets
        };
        
        const result = await supabase
          .from('tweets')
          .insert(insertData)
          .select();
          
        data = result.data;
        error = result.error;
      }
      
      console.log('Supabase response - data:', data);
      console.log('Supabase response - error:', error);
      
      if (error) {
        console.error('Supabase error details:', error.code, error.message, error.details);
        throw error;
      }

      if (data && data[0]) {
        console.log('Successfully saved tweet, updating state...');
        
        // Update the savedTweets state with the updated/new record
        setSavedTweets(prev => {
          // Remove the old version if it exists
          const filtered = prev.filter(t => t.id !== data[0].id);
          // Add the new version
          return [...filtered, data[0]];
        });
        
        // For guest users, track this tweet ID in the session
        if (!user && data[0].id) {
          setSessionTweetIds(prev => {
            if (!prev.includes(data[0].id)) {
              return [...prev, data[0].id];
            }
            return prev;
          });
        }
        
        setIsPopoutVisible(true);
        // Only pass allGeneratedTweets if it's not null
        console.log('Calling trackActivity with save event...');
        await trackActivity('save', allGeneratedTweets || undefined);
        console.log('trackActivity completed');
      } else {
        console.warn('No data returned from tweet update/insert operation');
      }
    } catch (error) {
      console.error('Error saving tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tweet');
    }
  };

  const handleClear = () => {
    resetState();  // Use the resetState function instead of individual setters
  };

  // Modify handleDeleteTweet to track session tweets
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
      
      // For guest users, also remove from session tracking
      if (!user && tweet.id) {
        setSessionTweetIds(prev => prev.filter(id => id !== tweet.id));
      }

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
    setIsPopoutVisible(false); // Hide saved tweets sidebar
  };

  // Add this helper function
  const getRemainingCharacters = (content: string): number => {
    const urlLength = sourceUrl ? 25 : 0;  // URL counts as 25 if present
    return 280 - content.length - urlLength;
  };

  // Add a test function to check if we can insert data into the tweets table
  const testTweetsTableInsert = async () => {
    try {
      console.log('=== TEST TWEETS TABLE INSERT ===');
      console.log('Current user state:', user ? 'Authenticated' : 'Guest');
      
      // Create a simple test object
      const testData = {
        content: "Test tweet " + new Date().toISOString(),
        created_at: new Date().toISOString(),
        source_url: null,
        user_id: user?.id || null,  // Will be null for guest mode
        user_input: "Test input",
        input_length: 10,
        input_token_cost: 3,
        generated_tweets: { tweets: [{ content: "Test generated tweet" }] },
        generated_tweets_metrics: JSON.stringify([{ content: "Test", length: 4, token_cost: 1 }]),
        saved_tweet_length: 10,
        saved_tweet_token_cost: 3,
        hashtags: ["#test"],
        all_generated_tweets: JSON.stringify({ test: true })
      };
      
      console.log('Test data for tweets table:', testData);
      console.log('Test data user_id:', testData.user_id);
      
      // Try to insert the test data
      console.log('Calling supabase.from("tweets").insert() with test data...');
      const { data, error } = await supabase
        .from('tweets')
        .insert(testData)
        .select();
      
      console.log('Supabase test response - data:', data);
      console.log('Supabase test response - error:', error);
      
      if (error) {
        console.error('Supabase error details:', error.code, error.message, error.details);
        setError(`Test insert failed: ${error.message}`);
      } else if (data && data.length > 0) {
        // If successful, also try to load tweets to verify they can be retrieved
        console.log('Test insert succeeded! ID:', data[0].id);
        setError(`Test insert succeeded! ID: ${data[0].id}`);
        
        // Refresh the saved tweets list
        if (user) {
          const { data: loadedData } = await supabase
            .from('tweets')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          console.log('Loaded authenticated user tweets:', loadedData);
        } else {
          const { data: loadedData } = await supabase
            .from('tweets')
            .select('*')
            .is('user_id', null)
            .order('created_at', { ascending: false });
          
          console.log('Loaded guest user tweets:', loadedData);
        }
      } else {
        setError('Test insert returned no data or error');
      }
    } catch (e) {
      console.error('Error in test insert:', e);
      setError(`Test error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const trackActivity = async (event: 'generate' | 'save' = 'generate', allGeneratedTweetsData?: string) => {
    try {
      console.log(`=== TRACK ACTIVITY DEBUG (${event}) ===`);
      console.log('Event:', event);
      console.log('All generated tweets data provided:', allGeneratedTweetsData ? 'Yes' : 'No');
      
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
        
        // Log the extracted hashtags with more detail
        console.log('Extracted hashtags for activity:', extractedHashtags);
        console.log('Number of hashtags extracted:', extractedHashtags.length);
        console.log('Hashtag extraction source tweets:', tweets.map(t => t.content));
        
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
          total_tokens_spent: Math.ceil((inputText?.length || 0) / 4) || 0,
          // Add all generated tweets data if provided
          ...(allGeneratedTweetsData ? { all_generated_tweets: allGeneratedTweetsData } : {})
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
          console.log('Handling save event in trackActivity');
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
          
          // Log detailed hashtag information
          console.log('Extracted hashtags for saved tweet:', hashtags);
          console.log('Number of hashtags in saved tweet:', hashtags.length);
          console.log('Saved tweet content for hashtag extraction:', lastSavedTweet.content);
          
          // Log the metrics data from the saved tweet
          console.log('Metrics from saved tweet:', lastSavedTweet.generated_tweets_metrics);
          
          // Create update data object
          const updateData: any = {
            hashtags_saved: hashtags
          };
          
          // Add all_generated_tweets data if provided
          if (allGeneratedTweetsData) {
            updateData.all_generated_tweets = allGeneratedTweetsData;
            console.log('Adding all_generated_tweets to activity update:', allGeneratedTweetsData);
          }
          
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

  // Helper function to get tweets for the current user/session
  const getVisibleTweets = () => {
    if (user) {
      // For authenticated users, show their tweets
      return savedTweets.filter(tweet => tweet.user_id === user.id);
    } else {
      // For guest users, only show tweets from this session
      return savedTweets.filter(tweet => sessionTweetIds.includes(tweet.id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 pt-16">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold ml-[-16px]">Tweet Reply Generator</h1>
          <TrendingHashtags />
          {user ? (
            <div className="flex items-center space-x-4">
              <button
                onClick={testTweetsTableInsert}
                className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
              >
                Test DB
              </button>
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
            </div>
          ) : (
            <a
              onClick={() => setShowAuth(true)}
              className="text-blue-500 hover:text-black-600 cursor-pointer relative group"
              title="Account Advantages"
            >
              Sign In
              <div className="absolute hidden group-hover:block bg-white border border-gray-200 shadow-md rounded p-2 right-0 mt-1 w-48 text-sm z-10">
                <div className="font-semibold mb-1 text-black">Account Advantages</div>
                <div className="text-black">{'>'} Permanently save tweets</div>
                <div className="text-black">{'>'} #Hashtag generation</div>
                <div className="text-black">{'>'} More tweet options</div>
              </div>
            </a>
          )}
        </div>
        {/* Show Saved Tweets button - only when there are tweets for the current user/session */}
        {getVisibleTweets().length > 0 && (
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

      {/* Saved tweets sidebar - only show when there are tweets for the current user/session */}
      {getVisibleTweets().length > 0 && (
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
              tweets={getVisibleTweets()}
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