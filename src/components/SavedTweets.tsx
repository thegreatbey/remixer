import React from 'react';

export interface Tweet {
  id: string;
  content: string;
  created_at: string | null;
  user_id?: string | null;
  source_url?: string; // Optional source attribution
}

interface SavedTweetsProps {
  tweets: Tweet[];
  onSaveTweet?: (tweet: Tweet) => void;
  onDeleteTweet?: (tweet: Tweet) => void;
  isSavedList?: boolean;
  sourceUrl?: string;
  getRemainingCharacters: (content: string) => number;
}

const SavedTweets: React.FC<SavedTweetsProps> = ({ 
  tweets, 
  onSaveTweet,
  onDeleteTweet,
  isSavedList = false,
  sourceUrl,
  getRemainingCharacters
}) => {
  console.log('SavedTweets props:', { tweets, onDeleteTweet, isSavedList }); // Debug log

  // Handle tweet sharing with source attribution
  const handleTweetThis = (content: string, sourceUrl?: string) => {
    let tweetText = content;
    
    // Add URL to tweet content if provided
    if (sourceUrl) {
      tweetText += ` ${sourceUrl}`;
    }
    
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
  };

  // Tweet display section
  return (
    <div className="space-y-4">
      {tweets.map((tweet) => {
        console.log('Rendering tweet:', tweet, 'isSavedList:', isSavedList); // Debug log
        // Use either saved URL or passed sourceUrl
        const tweetSourceUrl = tweet.source_url || sourceUrl;
        
        const remainingChars = getRemainingCharacters(tweet.content);
        const isValidTweet = remainingChars >= 0;

        return (
          <div key={tweet.id} className="p-4 bg-white rounded-lg shadow">
            {/* Tweet content */}
            <p className="text-gray-800 mb-2">{tweet.content}</p>
            
            {/* Source attribution - if available */}
            {tweetSourceUrl && (
              <p className="mt-2 text-sm text-gray-600">
                Source: <a href={tweetSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{tweetSourceUrl}</a>
              </p>
            )}
            
            {/* Character count - URL counts as 20 chars */}
            <div className={`text-sm ${isValidTweet ? 'text-gray-500' : 'text-red-500'}`}>
              {remainingChars} characters remaining
            </div>
            
            {/* Action buttons */}
            <div className="mt-2 flex space-x-2">
              <button 
                onClick={() => handleTweetThis(tweet.content, tweetSourceUrl)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Tweet This
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
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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