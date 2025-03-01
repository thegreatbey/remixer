import React from 'react';
import { Tweet } from '../types/types';

interface SavedTweetsProps {
  tweets: Tweet[];
  onSaveTweet?: (tweet: Tweet) => void;
  onDeleteTweet?: (tweet: Tweet) => void;
  onTweetThis?: (tweet: Tweet) => void;
  isSavedList?: boolean;
  sourceUrl?: string;
  getRemainingCharacters: (content: string) => number;
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
  console.log('SavedTweets props:', { tweets, onDeleteTweet, isSavedList }); // Debug log

  // Handle tweet sharing with source attribution
  const handleTweetThis = (tweet: Tweet, content: string, sourceUrl?: string) => {
    let tweetText = content;
    if (sourceUrl) {
      tweetText = `${content} ${sourceUrl}`.trim();  // Remove any extra spaces
    }
    
    // Call the onTweetThis callback if provided
    if (onTweetThis) {
      // Call the parent component's onTweetThis function first
      onTweetThis(tweet);
      
      // Add a small delay before opening the Twitter intent URL
      // This ensures the database update has time to start
      setTimeout(() => {
        // Then open the Twitter intent URL
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
      }, 100);
    } else {
      // If no onTweetThis callback, just open the Twitter intent URL
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
    }
  };

  // Tweet display section
  return (
    <div className={`${isSavedList ? 'space-y-2' : 'space-y-4'}`}>
      {tweets.map((tweet) => {
        console.log('Rendering tweet:', tweet, 'isSavedList:', isSavedList); // Debug log
        // Check if this tweet has been tweeted
        const isTweeted = !!tweet.tweeted;
        
        // Use either saved URL or passed sourceUrl
        const tweetSourceUrl = tweet.source_url || sourceUrl;
        
        const remainingChars = getRemainingCharacters(tweet.content);
        const isValidTweet = remainingChars >= 0;

        return (
          <div 
            key={tweet.id} 
            className={`${isSavedList ? 'p-3' : 'p-4'} rounded-lg shadow relative ${
              isTweeted ? 'bg-blue-50 border border-blue-200' : 'bg-white'
            }`}
          >
            {/* Tweeted badge */}
            {isTweeted && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                Tweeted
              </div>
            )}
            
            {/* Tweet content */}
            <p className={`text-gray-800 ${isSavedList ? 'mb-1 text-sm' : 'mb-2'} pr-16`}>{tweet.content}</p>
            
            {/* Source attribution - if available */}
            {tweetSourceUrl && (
              <p className={`${isSavedList ? 'mt-1' : 'mt-2'} text-sm text-gray-600`}>
                Source: <a href={tweetSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{tweetSourceUrl}</a>
              </p>
            )}
            
            {/* Character count - URL counts as 23 chars */}
            <div className={`text-sm ${isValidTweet ? 'text-gray-500' : 'text-red-500'}`}>
              {remainingChars} characters remaining
            </div>
            
            {/* Action buttons */}
            <div className={`${isSavedList ? 'mt-1' : 'mt-2'} flex space-x-2`}>
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
              {onDeleteTweet && isSavedList && (
                <button 
                  onClick={() => {
                    console.log('Delete button clicked for tweet:', tweet); // Debug log
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