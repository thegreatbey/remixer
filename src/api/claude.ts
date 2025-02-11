export const tweetsFromPost = async (text: string, isAuthenticated: boolean) => {
  const maxTokens = isAuthenticated ? 800 : 300; // Different token limits based on auth status

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        text, 
        isAuthenticated,
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