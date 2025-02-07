import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import cors from 'cors';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Debug logging
console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!process.env.SUPABASE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// Debug: Log environment variables (remove in production)
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY);

// Add error handling for Supabase initialization
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Test endpoint with more detailed error logging
app.get('/api/test', async (req, res) => {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('tweets')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
    
    console.log('Connection successful, data:', data);
    res.json({ message: 'Connected to Supabase successfully', data });
  } catch (error) {
    console.error('Detailed connection error:', error);
    res.status(500).json({ 
      error: 'Failed to connect to Supabase',
      details: error.message 
    });
  }
});

// GET tweets
app.get('/api/tweets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching tweets:', error);
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
});

// POST tweet
app.post('/api/tweets', async (req, res) => {
  try {
    const { content } = req.body;
    const { data, error } = await supabase
      .from('tweets')
      .insert([{ content }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error saving tweet:', error);
    res.status(500).json({ error: 'Failed to save tweet' });
  }
});

// Add this new endpoint for tweet generation with Claude
app.post('/api/generate', async (req, res) => {
  try {
    const { content } = req.body;
    console.log('Received content:', content);
    
    if (!process.env.CLAUDE_API_KEY) {
      console.error('CLAUDE_API_KEY is missing!');
      throw new Error('API key not configured');
    }
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Generate exactly 3 tweets based on this content. Return only the tweets, no introductory text or numbering: ${content}`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API Response:', response.status, errorText);
      throw new Error('Failed to call Claude API');
    }

    const data = await response.json();
    console.log('Claude response:', data);
    
    // Clean up the response to remove any introductory text
    const tweets = data.content[0].text
      .split('\n')
      .filter(tweet => tweet.trim())
      .filter(tweet => !tweet.includes('Here are'))
      .slice(0, 3);
    
    res.json(tweets);
    
  } catch (error) {
    console.error('Error generating tweets:', error);
    res.status(500).json({ error: 'Failed to generate tweets' });
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Supabase URL:', process.env.SUPABASE_URL);
});