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
}

const SavedTweets: React.FC<SavedTweetsProps> = ({ 
  tweets, 
  onSaveTweet,
  onDeleteTweet,
  isSavedList = false,
  sourceUrl
}) => {
  console.log('SavedTweets props:', { tweets, onDeleteTweet, isSavedList }); // Debug log

  // Calculate tweet character limits
  const getCharactersRemaining = (content: string, sourceUrl?: string) => {
    const urlCharCount = sourceUrl ? 20 : 0; // URLs count as 20 chars in Twitter
    return 280 - (content.length + urlCharCount);
  };

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
        
        return (
          <div key={tweet.id} className="p-4 bg-white rounded-lg shadow">
            {/* Tweet content */}
            <p>{tweet.content}</p>
            
            {/* Source attribution - if available */}
            {tweetSourceUrl && (
              <p className="mt-2 text-sm text-gray-600">
                Source: <a href={tweetSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{tweetSourceUrl}</a>
              </p>
            )}
            
            {/* Action buttons */}
            <div className="mt-2 flex space-x-2">
              <button 
                onClick={() => handleTweetThis(tweet.content, tweetSourceUrl)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Tweet This
              </button>
              {onSaveTweet && !isSavedList && (
                <button 
                  onClick={() => onSaveTweet(tweet)}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
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
            
            {/* Character count - URL counts as 20 chars */}
            <p className="mt-2 text-sm text-gray-500 italic">
              {getCharactersRemaining(tweet.content, tweetSourceUrl)} characters remaining
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default SavedTweets; 