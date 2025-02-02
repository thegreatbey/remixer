// Remove the direct Claude API call with dangerouslyAllowBrowser
// Instead, call our server endpoint
export const tweetsFromPost = async (content: string): Promise<string[]> => {
  try {
    const response = await fetch('/api/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error generating tweets:', error);
    return [];
  }
};