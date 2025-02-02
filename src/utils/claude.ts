import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  dangerouslyAllowBrowser: true  // Required for browser usage
});


export const remixContent = async (prompt: string): Promise<string> => {
  try {
    const response = await fetch('/api/remix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch');
    }
    
    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Error calling remix API:', error);
    throw error;
  }
}; 