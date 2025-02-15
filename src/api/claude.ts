export const tweetsFromPost = async (text: string, showAuthFeatures: boolean): Promise<string[]> => {
  const maxTokens = showAuthFeatures ? 800 : 300; // Different token limits based on auth status

  // Add debugging logs
  console.log('Auth params:', { 
    showAuthFeatures,
    maxTokens,
    timestamp: new Date().toISOString()
  });

  try {
    // Fetch the tweets from the server using the new API endpoint with the correct parameters. Leave api/generate as is.
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        showAuthFeatures,
        maxTokens // Pass the token limit to the API
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate tweets');
    }

    return await response.json();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};