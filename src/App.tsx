import { useState, useEffect } from 'react'
import { tweetsFromPost } from './api/claude'
import SavedTweets from './components/SavedTweets'
import { supabase, getAuthState } from './api/supabase'
import { User } from '@supabase/supabase-js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Tweet } from './types/types'
import TrendingHashtags from './components/TrendingHashtags'
import WordCaptcha from './components/WordCaptcha'
//import type { Json } from './types/supabase'

// Add interface for tweet metrics
interface TweetMetrics {
  content: string;
  length: number;
  token_cost: number;
}

// Add interface for conversation history
interface ConversationHistory {
  inputs: string[];
  outputs: string[];
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
  // Add conversation mode state
  const [conversationModeEnabled, setConversationModeEnabled] = useState(false);
  // Add conversation history state for authenticated users
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory>({
    inputs: [],
    outputs: []
  });
  // Change background color for conversation mode from blue to purple
  const conversationModeColor = 'bg-purple-200';
  // Add a session ID for guest users
  const [guestSessionId] = useState<string>(() => {
    // Generate a unique session ID for this browser session
    return 'guest-' + Math.random().toString(36).substring(2, 15);
  });
  // Track session tweets separately without affecting database operations
  const [sessionTweetIds, setSessionTweetIds] = useState<string[]>([]);
  // Add a new state variable to track if CAPTCHA is completed
  const [captchaCompleted, setCaptchaCompleted] = useState<boolean>(false);
  // Add conversation mode explanation state
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  // Add state for TOS and Privacy Policy panels
  const [showTOS, setShowTOS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  // Add success message state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add check for Supabase configuration
  const { isConfigured, error: configError } = getAuthState();
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
        <div className="relative py-3 sm:max-w-xl sm:mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
          <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
            <div className="max-w-md mx-auto">
              <div className="divide-y divide-gray-200">
                <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                  <p className="text-red-600 font-bold">Configuration Error</p>
                  <p>{configError || 'The app is missing required environment variables.'}</p>
                  <p>Please check your Supabase configuration in the deployment settings.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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

  // Modify handleRemix to use conversation history for authenticated users
  const handleRemix = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let contextForConversation = '';
      
      // Only include conversation history for authenticated users with conversation mode enabled
      if (user && conversationModeEnabled && conversationHistory.inputs.length > 0) {
        // Format conversation history for Claude
        const formattedHistory = conversationHistory.inputs.map((input, index) => {
          const output = conversationHistory.outputs[index] || '';
          return `User: ${input}\n\nAssistant: ${output}\n\n`;
        }).join('');
        
        contextForConversation = formattedHistory;
      }
      
      // Pass conversation history to tweetsFromPost if needed
      const generatedTweets = await tweetsFromPost(
        inputText, 
        !!user, 
        conversationModeEnabled && !!user ? contextForConversation : undefined
      );
      
      // Update conversation history for authenticated users in conversation mode
      if (user && conversationModeEnabled) {
        setConversationHistory(prev => {
          const newInputs = [...prev.inputs, inputText];
          // Join all generated tweets as a single response for the history
          const newOutputs = [...prev.outputs, generatedTweets.join('\n\n')];
          return { inputs: newInputs, outputs: newOutputs };
        });
      }
      
      // Store ALL generated tweets before filtering, including metadata
      const allGeneratedTweetsData = {
        original_input: inputText,
        source_url: sourceUrl || null,
        timestamp: new Date().toISOString(),
        is_conversation_mode: conversationModeEnabled && !!user,
        all_tweets: generatedTweets.map((content: string) => {
          let urlLength = 0;
          if (sourceUrl) {
            if (sourceUrl.startsWith('http://')) {
              urlLength = 23; // HTTP URLs count as 23 characters
            } else if (sourceUrl.startsWith('https://')) {
              urlLength = 25; // HTTPS URLs count as 25 characters
            } else {
              urlLength = 23; // Default to HTTP length if protocol is not specified
            }
          }
          return {
            content,
            length: content.length,
            characters_remaining: 280 - content.length - urlLength,
            hashtags: extractHashtags(content),
            is_valid: content.length <= 280
          };
        })
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
          all_generated_tweets: allGeneratedTweetsJSON, // Add all generated tweets data
          is_conversation_mode: conversationModeEnabled && !!user // Flag for conversation mode tweets
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
        // For guest users, we no longer track empty content tweets in the session
        // We'll only track tweets after they're explicitly saved with content
        // This prevents empty tweets from showing up in the saved tweets sidebar
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
        let query = supabase
          .from('tweets')
          .select('*')
          .eq('all_generated_tweets', allGeneratedTweets);
        
        // Use .is() for null values and .eq() for string values
        if (user?.id) {
          query = query.eq('user_id', user.id);
        } else {
          query = query.is('user_id', null);
        }
        
        const result = await query;
        
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
        hashtags: hashtags,
        is_conversation_mode: tweet.is_conversation_mode || false // Add conversation mode flag
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
        // Only track tweets with actual content
        if (!user && data[0].id && data[0].content && data[0].content.trim() !== "") {
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
        setSuccessMessage('Tweet saved successfully!');
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

  // Add conversation reset function
  const resetConversation = () => {
    // Reset conversation history but keep mode enabled
    setConversationHistory({ inputs: [], outputs: [] });
    setError(null);
  };

  // Add this helper function
  const getRemainingCharacters = (content: string): number => {
    let urlLength = 0;
    if (sourceUrl) {
      // Check if URL starts with http:// or https://
      if (sourceUrl.startsWith('http://')) {
        urlLength = 23; // HTTP URLs count as 23 characters
      } else if (sourceUrl.startsWith('https://')) {
        urlLength = 25; // HTTPS URLs count as 25 characters
      } else {
        urlLength = 23; // Default to HTTP length if protocol is not specified
      }
    }
    return 280 - content.length - urlLength;
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

  // Filter tweets for display in the saved tweets sidebar
  // This ensures only explicitly saved tweets with content are shown
  // and handles both authenticated and guest user sessions
  const getVisibleTweets = () => {
    if (user) {
      // For authenticated users:
      // - Show only tweets owned by the current user
      // - Only include tweets with actual content (not empty placeholders)
      // - This filters out tweets that were generated but not explicitly saved
      return savedTweets.filter(tweet => 
        tweet.user_id === user.id && 
        tweet.content && 
        tweet.content.trim() !== ""
      );
    } else {
      // For guest users:
      // - Only show tweets from the current browser session
      // - Only include tweets with null user_id (guest tweets)
      // - Only include tweets with actual content (not empty placeholders)
      // - This prevents seeing tweets from previous guest sessions
      return savedTweets.filter(tweet => 
        sessionTweetIds.includes(tweet.id) && 
        tweet.user_id === null &&
        tweet.content && 
        tweet.content.trim() !== ""
      );
    }
  };

  // Process a tweet for sharing to Twitter
  // This function:
  // - Handles both generated and saved tweets
  // - Updates the database to mark tweets as tweeted
  // - Updates the UI state to reflect tweeted status
  // - Works for both authenticated and guest users
  const handleTweetThis = async (tweet: Tweet) => {
    try {
      // Prepare the tweet text with source URL if available
      const tweetSourceUrl = tweet.source_url || sourceUrl;
      let tweetText = tweet.content;
      if (tweetSourceUrl) {
        tweetText = `${tweet.content} ${tweetSourceUrl}`.trim();
      }
      
      // Handle generated tweets that haven't been saved yet
      // Generated tweets have temporary IDs like 'generated-0'
      if (tweet.id && tweet.id.startsWith('generated-')) {
        // Save the tweet first to get a permanent database ID
        await handleSaveTweet(tweet);
        
        // Find the newly saved tweet in the database
        const { data: savedTweets, error: findError } = await supabase
          .from('tweets')
          .select('*')
          .eq('content', tweet.content)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (findError || !savedTweets || savedTweets.length === 0) {
          setError('Could not find saved tweet to update. Please try again.');
          return;
        }
        
        // Use the permanent database ID for the update
        tweet = savedTweets[0];
      }
      
      // Mark the tweet as tweeted in the database
      const { data: updatedTweet, error: updateError } = await supabase
        .from('tweets')
        .update({ tweeted: tweetText })
        .eq('id', tweet.id)
        .select()
        .single();
        
      if (updateError) {
        console.error('Error updating tweeted column:', updateError);
        setError(`Failed to update database: ${updateError.message}`);
      } else {
        // Update the UI to reflect the tweeted status
        // This ensures the tweet shows as "Tweeted" immediately
        if (updatedTweet) {
          setSavedTweets(prev => 
            prev.map(t => t.id === updatedTweet.id ? updatedTweet : t)
          );
        }
        
        // Record the tweet action in the activity table for analytics
        let lastActivity;
        
        if (user?.id) {
          // For authenticated users - find their most recent activity
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
        
        // Update the activity record with the tweeted content
        if (lastActivity && lastActivity.length > 0) {
          await supabase
            .from('activity')
            .update({ tweeted_tweet: tweetText })
            .eq('id', lastActivity[0].id);
        }
      }
    } catch (error) {
      console.error('Error in handleTweetThis:', error);
      setError(`Error tweeting: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Add loading animation component
  const LoadingAnimation = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-lg p-3 sm:p-6 shadow-xl max-w-sm w-full mx-4 animate-slide-in">
        <div className="flex flex-col items-center space-y-2 sm:space-y-4">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
          <p className="text-xs sm:text-base text-gray-700">Generating tweets{loadingDots}</p>
        </div>
      </div>
    </div>
  );

  // Add error notification component
  const ErrorNotification = ({ message }: { message: string }) => (
    <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded shadow-lg z-50 max-w-sm w-full mx-4 animate-slide-in">
      <div className="flex items-center">
        <div className="py-0.5 sm:py-1">
          <p className="text-xs sm:text-sm">{message}</p>
        </div>
        <button
          onClick={() => setError(null)}
          className="ml-auto pl-2 sm:pl-3 text-red-700 hover:text-red-900 transition-colors duration-200"
          aria-label="Close error message"
        >
          ×
        </button>
      </div>
    </div>
  );

  // Add success notification component
  const SuccessNotification = ({ message }: { message: string }) => (
    <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-3 sm:px-4 py-2 sm:py-3 rounded shadow-lg z-50 max-w-sm w-full mx-4 animate-slide-in">
      <div className="flex items-center">
        <div className="py-0.5 sm:py-1">
          <p className="text-xs sm:text-sm">{message}</p>
        </div>
        <button
          onClick={() => setSuccessMessage(null)}
          className="ml-auto pl-2 sm:pl-3 text-green-700 hover:text-green-900 transition-colors duration-200"
          aria-label="Close success message"
        >
          ×
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${conversationModeEnabled ? conversationModeColor : 'bg-gray-100'}`}>
      {isLoading && <LoadingAnimation />}
      {error && <ErrorNotification message={error} />}
      {successMessage && <SuccessNotification message={successMessage} />}
      <div className="min-h-screen bg-gray-100 p-2 sm:p-8 pt-4 sm:pt-16">
        <div className="max-w-4xl mx-auto p-2 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-0">Tweet Reply Generator</h1>
            {/* Mobile-only single line layout */}
            <div className="flex sm:hidden items-center justify-between gap-2">
              <TrendingHashtags />
              <div className="flex items-center space-x-4">
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  window.location.href = 'mailto:' + 'hi' + '@' + 'twtbk.app';
                }}
                  className="text-black hover:underline relative group"
                >
                  hitwtbkapp
                  <div className="absolute hidden group-hover:block bg-white border border-gray-200 shadow-md rounded p-2 left-0 mt-1 w-48 text-sm z-10">
                    <div className="text-black font-bold">Get In Touch</div>
                    <div className="text-black">{'>'} Suggestions</div>
                    <div className="text-black">{'>'} Improvements</div>
                    <div className="text-black">{'>'} Questions</div>
                    <div className="text-black">{'>'} Just say hi!</div>
                  </div>
                </a>
                {user ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Welcome, {user.email}</span>
                    <a
                      onClick={async () => {
                        try {
                          const signOutTime = new Date();
                          const { error: activityError } = await supabase.from('activity').update({
                            sign_out_time: signOutTime.toISOString(),
                            session_duration: Math.floor((signOutTime.getTime() - new Date(user.last_sign_in_at || signOutTime.toISOString()).getTime()) / 1000)
                          }).eq('user_id', user.id).is('sign_out_time', null);

                          if (activityError) {
                            console.error('Error updating activity:', activityError);
                          }

                          await supabase.auth.signOut();
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
                      <div className="text-black">{'>'} Conversation Mode</div>
                    </div>
                  </a>
                )}
              </div>
            </div>
            {/* Desktop layout */}
            <div className="hidden sm:flex items-center space-x-4 sm:space-x-9">
              <TrendingHashtags />
              <a href="#" onClick={(e) => {
                e.preventDefault();
                window.location.href = 'mailto:' + 'hi' + '@' + 'twtbk.app';
              }}
                className="text-black hover:underline relative group"
              >
                hitwtbkapp
                <div className="absolute hidden group-hover:block bg-white border border-gray-200 shadow-md rounded p-2 left-0 mt-1 w-48 text-sm z-10">
                  <div className="text-black font-bold">Get In Touch</div>
                  <div className="text-black">{'>'} Suggestions</div>
                  <div className="text-black">{'>'} Improvements</div>
                  <div className="text-black">{'>'} Questions</div>
                  <div className="text-black">{'>'} Just say hi!</div>
                </div>
              </a>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-base text-gray-600">Welcome, {user.email}</span>
                  <a
                    onClick={async () => {
                      try {
                        const signOutTime = new Date();
                        const { error: activityError } = await supabase.from('activity').update({
                          sign_out_time: signOutTime.toISOString(),
                          session_duration: Math.floor((signOutTime.getTime() - new Date(user.last_sign_in_at || signOutTime.toISOString()).getTime()) / 1000)
                        }).eq('user_id', user.id).is('sign_out_time', null);

                        if (activityError) {
                          console.error('Error updating activity:', activityError);
                        }

                        await supabase.auth.signOut();
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
                    <div className="text-black">{'>'} Conversation Mode</div>
                  </div>
                </a>
              )}
            </div>
          </div>
          {/* Show Saved Tweets button - only when there are tweets for the current user/session */}
          {getVisibleTweets().length > 0 && (
            <button
              onClick={() => setIsPopoutVisible(true)}
              className="fixed sm:absolute top-2 sm:top-4 right-2 sm:right-24 bg-green-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded hover:bg-green-600 text-sm sm:text-base"
            >
              Show Saved Tweets
            </button>
          )}
        </div>
        <div className="space-y-2 max-w-4xl mx-auto">
          <textarea
            className="w-full h-32 sm:h-48 p-3 sm:p-4 border rounded resize-none text-base sm:text-lg"
            placeholder="Type/paste your text here. I'll generate your tweets."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          
          {/* Source URL input - optional */}
          <input
            type="text"
            className="w-full p-2 border rounded text-base sm:text-lg"
            placeholder="Optional: Add source URL"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
          
          {error && (
            <div className="text-red-500 text-xs sm:text-sm mb-2">
              {error}
            </div>
          )}

          {/* Conversation Mode explanation and button - only for authenticated users */}
          {user && (
            <>
              <div className="mb-1 relative">
                <span 
                  onClick={() => setShowConversationInfo(prevState => !prevState)} 
                  className="cursor-pointer text-black hover:text-purple-800 hover:underline inline-block text-sm sm:text-base"
                >
                  What is Conversation Mode?
                </span>
                {showConversationInfo && (
                  <div className="mt-1 p-2 sm:p-3 bg-white border border-gray-200 rounded-md shadow-sm text-xs sm:text-sm">
                    <p className="text-gray-700 mb-2">
                      Conversation Mode enables me to remember your previous inputs and generated tweets, creating a continuous conversation.
                    </p>
                    <p className="text-gray-700">
                      This helps generate more contextually relevant tweets that build upon your earlier interactions.
                    </p>
                  </div>
                )}
              </div>
              {conversationModeEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <button
                    onClick={() => {
                      setConversationModeEnabled(false);
                      setConversationHistory({ inputs: [], outputs: [] });
                    }}
                    className={`w-full px-4 py-2 rounded font-semibold text-base sm:text-lg ${conversationModeColor} text-black-500 hover:bg-purple-300`}
                  >
                    <span>
                      Conversation Mode Enabled <span className="inline-block ml-1">✓</span>
                    </span>
                  </button>
                  
                  <button
                    onClick={resetConversation}
                    className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-base sm:text-lg font-medium"
                  >
                    Reset Conversation
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setConversationModeEnabled(true);
                    console.log('Conversation mode enabled - Token limit: 1200');
                  }}
                  className="w-full px-4 py-2 rounded font-semibold text-base sm:text-lg bg-purple-500 text-white hover:bg-purple-600"
                >
                  Enable Conversation Mode
                </button>
              )}
            </>
          )}
          
          {tweets.length === 0 ? (
            /* Conditionally show CAPTCHA or Generate Button based on user auth status and CAPTCHA completion */
            user || captchaCompleted ? (
              <button
                onClick={handleRemix}
                disabled={isLoading || !inputText.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-base sm:text-lg min-w-[150px]"
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
              <WordCaptcha onSuccess={() => setCaptchaCompleted(true)} />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <button
                onClick={handleRemix}
                disabled={isLoading || !inputText.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-base sm:text-lg min-w-[150px]"
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
                className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-base sm:text-lg font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Generated tweets section */}
        {tweets.length > 0 && (
          <div className="mt-6 sm:mt-8 max-w-4xl mx-auto px-2 sm:px-4">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Generated Tweets</h2>
            <SavedTweets 
              tweets={tweets} 
              onSaveTweet={handleSaveTweet}
              onTweetThis={handleTweetThis}
              isSavedList={false}
              getRemainingCharacters={getRemainingCharacters}
              sourceUrl={sourceUrl}
            />
          </div>
        )}

        {/* Saved tweets sidebar - only show when there are tweets for the current user/session */}
        {getVisibleTweets().length > 0 && (
          <div className={`fixed top-0 right-0 h-full w-full sm:w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
            isPopoutVisible ? 'translate-x-0' : 'translate-x-full'
          }`}>
            <div className="p-3 sm:p-4 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-bold">Saved Tweets</h2>
                <button 
                  onClick={() => {
                    setIsPopoutVisible(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-1 sm:p-2"
                  aria-label="Close saved tweets"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 overflow-y-auto h-[calc(100%-65px)]">
              <SavedTweets 
                tweets={getVisibleTweets()}
                onDeleteTweet={handleDeleteTweet}
                onTweetThis={handleTweetThis}
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

        {/* Footer with TOS and Privacy Policy */}
        <footer className="mt-24 sm:mt-0 sm:fixed sm:bottom-0 sm:left-0 sm:right-0 border-t py-3 sm:py-4 bg-white">
          <div className="max-w-4xl mx-auto px-4 text-center text-xs sm:text-sm text-gray-600">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  if (showTOS) {
                    setShowTOS(false);
                  } else {
                    setShowTOS(true);
                    setShowPrivacy(false);
                  }
                }}
                className={`hover:text-black hover:underline ${showTOS ? 'text-black font-semibold' : ''}`}
              >
                TOS
              </button>
              <button
                onClick={() => {
                  if (showPrivacy) {
                    setShowPrivacy(false);
                  } else {
                    setShowPrivacy(true);
                    setShowTOS(false);
                  }
                }}
                className={`hover:text-black hover:underline ${showPrivacy ? 'text-black font-semibold' : ''}`}
              >
                Privacy Policy
              </button>
              <span>© TWTBK.APP / TWTBK.COM 2025-</span>
            </div>
          </div>
        </footer>

        {/* TOS Panel */}
        {showTOS && (
          <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:left-1/2 sm:transform sm:-translate-x-1/2 w-full sm:w-auto sm:max-w-2xl bg-white border rounded-lg shadow-lg z-50 m-4 sm:m-0">
            <div className="p-2 sm:p-4 border-b flex justify-between items-center">
              <h3 className="text-sm sm:text-lg font-semibold">Terms of Service</h3>
              <button
                onClick={() => setShowTOS(false)}
                className="text-gray-500 hover:text-gray-700 p-1 sm:p-2 transition-colors duration-200"
                aria-label="Close terms of service"
              >
                ×
              </button>
            </div>
            <div className="p-2 sm:p-4 max-h-[80vh] sm:max-h-[60vh] overflow-y-auto">
              <div className="space-y-2 sm:space-y-4 text-xs sm:text-sm text-gray-600">
                <p>By using this application, you agree to the following:</p>
                <div>
                  <p className="font-semibold">Usage</p>
                  <p>This app is provided "as is" without warranties. Use at your own discretion.</p>
                </div>
                <div>
                  <p className="font-semibold">Content</p>
                  <p>We do not guarantee the accuracy of responses and are not responsible for any decisions based on them.</p>
                </div>
                <div>
                  <p className="font-semibold">Data</p>
                  <p>You agree not to misuse or exploit the app in ways that violate laws or ethical guidelines.</p>
                </div>
                <div>
                  <p className="font-semibold">No Liability</p>
                  <p>We are not responsible for any outcomes, decisions, or actions taken based on the app's responses.</p>
                </div>
                <div>
                  <p className="font-semibold">Acceptable Use</p>
                  <p>You agree not to use this app for illegal, harmful, or unethical purposes. Abuse may result in access restrictions.</p>
                </div>
                <div>
                  <p className="font-semibold">Changes</p>
                  <p>These terms may be updated at any time. Continued use implies acceptance of changes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Policy Panel */}
        {showPrivacy && (
          <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:left-1/2 sm:transform sm:-translate-x-1/2 w-full sm:w-auto sm:max-w-2xl bg-white border rounded-lg shadow-lg z-50 m-4 sm:m-0">
            <div className="p-2 sm:p-4 border-b flex justify-between items-center">
              <h3 className="text-sm sm:text-lg font-semibold">Privacy Policy</h3>
              <button
                onClick={() => setShowPrivacy(false)}
                className="text-gray-500 hover:text-gray-700 p-1 sm:p-2 transition-colors duration-200"
                aria-label="Close privacy policy"
              >
                ×
              </button>
            </div>
            <div className="p-2 sm:p-4 max-h-[80vh] sm:max-h-[60vh] overflow-y-auto">
              <div className="space-y-2 sm:space-y-4 text-xs sm:text-sm text-gray-600">
                <div>
                  <p className="font-semibold">Data Collection</p>
                  <p>We may collect input text and usage data to improve performance. We do not store personal information.</p>
                </div>
                <div>
                  <p className="font-semibold">Third-Party Services</p>
                  <p>Our app may interact with external APIs, but we do not share identifiable user data.</p>
                </div>
                <div>
                  <p className="font-semibold">Cookies</p>
                  <p>We may use cookies or local storage for app functionality.</p>
                </div>
                <div>
                  <p className="font-semibold">Your Rights</p>
                  <p>You can stop using the app at any time. Contact us for data inquiries.</p>
                </div>
                <div>
                  <p className="font-semibold">What We Collect</p>
                  <p>We may collect basic usage data, such as queries or interactions, to improve app functionality. However, we do not collect personally identifiable information.</p>
                </div>
                <div>
                  <p className="font-semibold">How We Use Your Data</p>
                  <p>Any collected data is used solely for app improvements and analytics. We do not sell, rent, or trade your information with third parties.</p>
                </div>
                <div>
                  <p className="font-semibold">Third-Party Services</p>
                  <p>Our app may interact with external APIs, but no personal user data is shared with these services.</p>
                </div>
                <div>
                  <p className="font-semibold">Cookies & Local Storage</p>
                  <p>We may use cookies or local storage for app functionality, but not for tracking purposes.</p>
                </div>
                <div>
                  <p className="font-semibold">Your Choices</p>
                  <p>You can stop using the app at any time. If you have concerns about data usage, you can contact us.</p>
                </div>
                <p className="mt-4">By continuing, you agree to these terms.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App