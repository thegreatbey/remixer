import React from 'react'
import { useState } from 'react'
import { generateResponse } from './utils/claude'

function App() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleRemix = async () => {
    setIsLoading(true)
    try {
      const remixedText = await generateResponse(inputText)
      setOutputText(remixedText)
    } catch (error) {
      console.error('Error remixing text:', error)
    }
    setIsLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText)
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">Content Remix</h1>
        
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your content here..."
          className="w-full h-48 p-4 border rounded-lg"
        />

        <button
          onClick={handleRemix}
          disabled={isLoading || !inputText}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          {isLoading ? 'Remixing...' : 'Remix Content'}
        </button>

        {outputText && (
          <div className="space-y-4">
            <textarea
              value={outputText}
              readOnly
              className="w-full h-48 p-4 border rounded-lg"
            />
            <button
              onClick={handleCopy}
              className="w-full py-2 px-4 bg-green-500 text-white rounded-lg"
            >
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App 