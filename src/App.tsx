import { useState } from 'react'
import { tweetsFromPost } from './api/claude'
import SavedTweets from './components/SavedTweets'

interface Tweet {
  id: string;
  content: string;
  created_at: string;
}

const App = () => {
  const [inputText, setInputText] = useState<string>('')
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isPopoutVisible, setIsPopoutVisible] = useState(false)
  const [savedTweets, setSavedTweets] = useState<Tweet[]>([])

  const handleRemix = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Starting remix with:', inputText);
      const generatedTweets = await tweetsFromPost(inputText);
      setTweets(generatedTweets.map((content, index) => ({
        id: `generated-${index}`,
        content,
        created_at: new Date().toISOString()
      })));
    } catch (error) {
      console.error('Error remixing text:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate tweets');
    } finally {
      setIsLoading(false);
    }
  }

  const handleSaveTweet = async (tweet: Tweet) => {
    try {
      const response = await fetch('/api/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweet),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save tweet');
      }
      
      setSavedTweets((prev) => [...prev, tweet]);
      setIsPopoutVisible(true);
    } catch (error) {
      console.error('Error saving tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to save tweet');
    }
  };

  const handleClear = () => {
    setInputText('');
    setTweets([]);
  };

  const handleDeleteTweet = async (id: string) => {
    try {
      const response = await fetch(`/api/tweets/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete tweet');
      
      setSavedTweets(prev => prev.filter(tweet => tweet.id !== id));
    } catch (error) {
      console.error('Error deleting tweet:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tweet');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Tweet Generator</h1>
        
        <div className="mb-8">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-6 border rounded-lg shadow-sm text-lg"
            placeholder="Type/paste your text here. I'll generate your tweets."
            rows={8}
          />
          <div className="flex space-x-4">
            <button
              onClick={handleRemix}
              disabled={isLoading}
              className={`mt-4 px-8 py-4 text-xl bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 ${
                tweets.length > 0 ? 'w-1/2' : 'w-full'
              }`}
            >
              {isLoading ? 'Generating...' : 'Generate Tweets'}
            </button>
            {tweets.length > 0 && (
              <button
                onClick={handleClear}
                className="mt-4 px-6 py-2 w-1/2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              >
                Clear Input
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-red-500">{error}</p>}
        </div>

        {tweets.length > 0 && (
          <SavedTweets 
            tweets={tweets} 
            onSaveTweet={handleSaveTweet} 
          />
        )}
        
        {/* Collapsible saved tweets panel */}
        <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          isPopoutVisible ? 'translate-x-0' : 'translate-x-full'
        } z-50`}>
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Saved Tweets</h2>
              <button 
                onClick={() => setIsPopoutVisible(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Collapse
              </button>
            </div>
            <SavedTweets 
              tweets={savedTweets} 
              onSaveTweet={() => {}}
              onDeleteTweet={handleDeleteTweet}
              isSavedList={true}
            />
          </div>
        </div>

        {/* Show panel button only when hidden AND we have saved tweets */}
        {!isPopoutVisible && savedTweets.length > 0 && (
          <button
            onClick={() => setIsPopoutVisible(true)}
            className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
          >
            Show Saved Tweets
          </button>
        )}
      </div>
    </div>
  )
}

export default App