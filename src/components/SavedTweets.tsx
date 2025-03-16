import React from 'react';
import { Tweet } from '../types/types';

// Props interface for the SavedTweets component
interface SavedTweetsProps {
  tweets: Tweet[];                              // Array of tweets to display
  onSaveTweet?: (tweet: Tweet) => void;         // Handler for saving tweets
  onDeleteTweet?: (tweet: Tweet) => void;       // Handler for deleting tweets
  onTweetThis?: (tweet: Tweet) => void;         // Handler for tweeting content
  isSavedList?: boolean;                        // Whether this is the saved tweets sidebar
  sourceUrl?: string;                           // Optional source URL to append to tweets
  getRemainingCharacters: (content: string) => number; // Function to calculate remaining characters
}

const SavedTweets: React.FC<SavedTweetsProps> = ({ 
  tweets, 
  onSaveTweet,
  onDeleteTweet,
  onTweetThis,
  isSavedList = false,
  sourceUrl,
  getRemainingCharacters
}) => {
  // Debug log removed for production

  // Handles the process of sharing a tweet to Twitter
  // Includes source URL attribution and database updates
  const handleTweetThis = (tweet: Tweet, content: string, sourceUrl?: string) => {
    let tweetText = content;
    // Append source URL if available
    if (sourceUrl) {
      tweetText = `${content} ${sourceUrl}`.trim();  // Remove any extra spaces
    }
    
    // Update database and then open Twitter intent
    if (onTweetThis) {
      // First update the database to mark this tweet as tweeted
      onTweetThis(tweet);
      
      // Add a small delay before opening Twitter
      // This ensures database updates have time to start
      setTimeout(() => {
        // Open Twitter intent URL in a new tab
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
      }, 100);
    } else {
      // If no database update handler provided, just open Twitter
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    }
  };

  // Render the list of tweets with appropriate styling and actions
  return (
    <div className={`${isSavedList ? 'space-y-2' : 'space-y-4'}`}>
      {tweets.map((tweet) => {
        // Debug log removed for production
        
        // Determine if this tweet has been previously tweeted
        const isTweeted = !!tweet.tweeted;
        
        // Use either the tweet's saved URL or the passed sourceUrl
        const tweetSourceUrl = tweet.source_url || sourceUrl;
        
        // Calculate remaining characters for Twitter's limit
        const remainingChars = getRemainingCharacters(tweet.content);
        const isValidTweet = remainingChars >= 0;

        // Determine if this is a conversation mode tweet
        const isConversationMode = !!tweet.is_conversation_mode;

        return (
          <div 
            key={tweet.id} 
            className={`${isSavedList ? 'p-3' : 'p-4'} rounded-lg shadow relative ${
              isConversationMode ? 'bg-purple-50 border border-purple-200' : 
              isTweeted ? 'bg-blue-50 border border-blue-200' : 
              'bg-white'
            }`}
          >
            {/* Visual indicator for tweets that have been shared */}
            {isTweeted && (
              <div className="absolute top-2 right-2 bg-blue-500 bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10 backdrop-blur-sm">
                Tweeted
              </div>
            )}
            
            {/* Visual indicator for conversation mode tweets */}
            {isConversationMode && (
              <div className={`absolute ${isTweeted ? 'top-9' : 'top-2'} right-2 bg-purple-600 bg-opacity-50 text-white text-xs px-2 py-1 rounded-full z-10 backdrop-blur-sm`}>
                Conversation
              </div>
            )}
            
            {/* The actual tweet content */}
            <p className={`text-gray-800 text-justify ${isSavedList ? 'mb-1 text-sm' : 'mb-2'} pr-2`}>{tweet.content}</p>
            
            {/* Display source URL if available */}
            {tweetSourceUrl && (
              <p className={`${isSavedList ? 'mt-1' : 'mt-2'} text-sm text-gray-600`}>
                Source: <a href={tweetSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{tweetSourceUrl}</a>
              </p>
            )}
            
            {/* Character count indicator */}
            <div className={`text-sm ${isValidTweet ? 'text-gray-500' : 'text-red-500'}`}>
              {remainingChars} characters remaining
            </div>
            
            {/* Action buttons with context-appropriate styling */}
            <div className={`${isSavedList ? 'mt-1' : 'mt-2'} flex space-x-2`}>
              {/* Tweet/Tweet Again button */}
              <button 
                onClick={() => handleTweetThis(tweet, tweet.content, tweetSourceUrl)}
                className={`${isSavedList ? 'px-3 py-1 text-sm' : 'px-4 py-2'} text-white rounded ${
                  isTweeted 
                    ? 'bg-blue-400 hover:bg-blue-500' // Lighter blue for already tweeted
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isTweeted ? 'Tweet Again' : 'Tweet This'}
              </button>
              
              {/* Save button - only shown in the main view, not in saved tweets sidebar */}
              {!isSavedList && (
                <button
                  onClick={() => onSaveTweet?.(tweet)}
                  disabled={!isValidTweet}
                  className={`px-4 py-2 rounded ${
                    isValidTweet 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Tweet
                </button>
              )}
              
              {/* Delete button - only shown in saved tweets sidebar */}
              {onDeleteTweet && isSavedList && (
                <button 
                  onClick={() => {
                    // Debug log removed for production
                    onDeleteTweet(tweet);
                  }}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete Tweet
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SavedTweets; 