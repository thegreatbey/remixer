import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.post('/api/remix', async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });
    res.json({ content: response.content[0].value });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});