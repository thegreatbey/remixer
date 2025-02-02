import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.post('/api/remix', async (req, res) => {
  try {
    console.log('Received request with prompt:', req.body.prompt);
    const { prompt } = req.body;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    
    // Access the text from the exact path we see in the response
    const content = response.content[0].text;
    console.log('Sending content:', content);
    res.json({ content });  // Send it as an object with a content property
  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    console.log('API Key:', process.env.CLAUDE_API_KEY);
    res.json({ message: 'API key loaded', keyExists: !!process.env.CLAUDE_API_KEY });
  } catch (error) {
    console.error('Test Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tweets', async (req, res) => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 150,
      system: "Return ONLY a JSON array with exactly 3 very short tweets. Please emphasize the reply or conversational nature of the tweet. Do dot return user's original sentences. Each tweet MUST be under 50 characters. Format: [\"short tweet 1\",\"short tweet 2\",\"short tweet 3\"]",
      messages: [{
        role: "user",
        content: req.body.content
      }]
    });
    
    console.log('Claude response:', response.content[0].text); // Debug log
    
    try {
      const tweets = JSON.parse(response.content[0].text);
      res.json(tweets);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Raw text:', response.content[0].text);
      res.status(500).json({ error: 'Failed to parse tweets' });
    }
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: 'Failed to generate tweets' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});