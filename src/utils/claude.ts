import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function remixContent(content: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Please remix the following content in a creative way: ${content}`
      }]
    });

    return response.content[0].value;
  } catch (error) {
    console.error('Error remixing content:', error);
    throw error;
  }
}

export const generateResponse = async (prompt: string): Promise<string> => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content[0].value;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}; 