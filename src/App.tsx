import { useState } from 'react'
import { tweetsFromPost } from './api/claude'

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('')
  const [tweets, setTweets] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleRemix = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log('Starting remix with:', inputText)
      const tweetArray = await tweetsFromPost(inputText)
      console.log('Got tweets:', tweetArray)
      setTweets(tweetArray)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      console.error('Error remixing text:', errorMessage)
      setError(errorMessage)
      setTweets([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleTweet = (tweet: string) => {
    const encodedTweet = encodeURIComponent(tweet);
    window.open(`https://twitter.com/intent/tweet?text=${encodedTweet}`, '_blank');
  }

  const handleCopy = (tweet: string, index: number) => {
    navigator.clipboard.writeText(tweet);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  const getCharacterCount = (tweet: string): number => {
    return 280 - tweet.length;
  }

  const handleClear = () => {
    setInputText('');
    setTweets([]);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center text-gray-800">Tweet Generator</h1>
        
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your content here..."
          className="w-full h-48 p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />

        {tweets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRemix}
              disabled={isLoading || !inputText}
              className="w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Generating Tweets...' : 'Generate Tweets'}
            </button>
            <button
              onClick={handleClear}
              className="w-full py-3 px-4 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Clear All
            </button>
          </div>
        ) : (
          <button
            onClick={handleRemix}
            disabled={isLoading || !inputText}
            className="w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Generating Tweets...' : 'Generate Tweets'}
          </button>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {tweets.length > 0 && (
          <div className="space-y-4">
            {tweets.map((tweet, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-300 p-4 space-y-3">
                <p className="text-gray-600 text-sm font-medium">Tweet {index + 1}</p>
                <p className="text-gray-800">{tweet}</p>
                <p className="text-gray-400 text-sm italic">
                  {getCharacterCount(tweet)} characters remaining
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTweet(tweet)}
                    className="py-2 px-4 bg-blue-400 text-white font-medium rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-colors"
                  >
                    Tweet This
                  </button>
                  <button
                    onClick={() => handleCopy(tweet, index)}
                    className={`py-2 px-4 ${copiedIndex === index ? 'bg-green-600' : 'bg-green-500'} text-white font-medium rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors`}
                  >
                    {copiedIndex === index ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App 