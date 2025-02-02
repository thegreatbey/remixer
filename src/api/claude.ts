export const tweetsFromPost = async (content: string): Promise<string[]> => {
  try {
    const response = await fetch('/api/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
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