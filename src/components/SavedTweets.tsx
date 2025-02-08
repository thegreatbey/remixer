import React from 'react';

interface Tweet {
  id: string;
  content: string;
  created_at: string;
}

interface SavedTweetsProps {
  tweets: Tweet[];
  onSaveTweet: (tweet: Tweet) => void;
  onDeleteTweet?: (id: string) => void;
  isSavedList?: boolean;
}

const SavedTweets: React.FC<SavedTweetsProps> = ({ 
  tweets, 
  onSaveTweet, 
  onDeleteTweet,
  isSavedList = false 
}) => {
  const handleTweetThis = (content: string) => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`;
    window.open(tweetUrl, '_blank');
  };

  return (
    <div className="space-y-4">
      {tweets.map((tweet) => (
        <div key={tweet.id} className="p-4 bg-white rounded-lg shadow">
          <p>{tweet.content}</p>
          <div className="mt-2 flex space-x-2">
            <button 
              onClick={() => handleTweetThis(tweet.content)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Tweet This
            </button>
            {!isSavedList && (
              <button 
                onClick={() => onSaveTweet(tweet)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Save Tweet
              </button>
            )}
            {isSavedList && onDeleteTweet && (
              <button 
                onClick={() => onDeleteTweet(tweet.id)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete Tweet
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500 italic">
            {280 - tweet.content.length} characters remaining
          </p>
        </div>
      ))}
    </div>
  );
};

export default SavedTweets; 