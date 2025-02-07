export const tweetsFromPost = async (content: string): Promise<string[]> => {
  try {
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      throw new Error('Failed to generate tweets');
    }
    
    const tweets = await response.json();
    if (!Array.isArray(tweets) || tweets.length !== 3) {
      throw new Error('Invalid response format from API');
    }
    return tweets;
  } catch (error) {
    console.error('Error generating tweets:', error);
    throw error;
  }
};