//ALWAYS use this import to be safe:
import React, { useState } from 'react'

import axios from 'axios'

function App() {
  console.log('App is rendering!')

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRemix = async () => {
    setLoading(true)
    try {
      const response = await axios.post('http://localhost:3000/api/remix', { text: input })
      setOutput(response.data)
    } catch (error) {
      console.error('Error:', error)
      setOutput('Error occurred while remixing')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-center">Content Remix</h1>
        
        <textarea
          className="w-full h-40 p-4 border rounded-lg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your content here..."
        />

        <button
          onClick={handleRemix}
          disabled={loading || !input}
          className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Remixing...' : 'Remix Content'}
        </button>

        {output && (
          <textarea
            className="w-full h-40 p-4 border rounded-lg"
            value={output}
            readOnly
          />
        )}
      </div>
    </div>
  )
}

export default App 