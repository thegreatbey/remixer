export const remixContent = async (content: string) => {
  try {
    console.log('Sending prompt:', content);
    const response = await fetch('/api/remix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: content }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const rawResponse = await response.text();  // Get raw response first
    console.log('Raw response:', rawResponse);  // Log it
    
    const data = JSON.parse(rawResponse);       // Then parse it
    console.log('Parsed data:', data);          // Log parsed data
    
    return data.content;
  } catch (error) {
    console.error('Error calling remix API:', error);
    throw error;
  }
};