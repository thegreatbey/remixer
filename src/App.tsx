import React, { useState } from 'react';
import { generateResponse } from './utils/claude';

function App(): JSX.Element {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleRemix = async (): Promise<void> => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    try {
      const prompt = `Transform the following content into something new and different. You can change anything about it - style, format, tone, perspective, etc. Here's the content to remix:\n\n${inputText}`;
      const response = await generateResponse(prompt);
      setOutputText(response);
    } catch (error) {
      console.error("Error:", error);
      alert("Error: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-5">
      <h1 className="text-3xl font-bold text-center mb-8">Remixer</h1>
      <div className="mb-6">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter anything here to remix..."
          rows={5}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
      </div>
      <button 
        onClick={handleRemix}
        disabled={isLoading || !inputText.trim()}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Remixing...' : 'Remix Content'}
      </button>
      {outputText && (
        <div className="mt-8 p-4 border border-gray-300 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Remixed Content:</h2>
          <div className="whitespace-pre-wrap text-gray-700">
            {outputText}
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 