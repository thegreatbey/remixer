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

const parseTweetsFromResponse = (data) => {
  if (!data || !data.content || !Array.isArray(data.content)) {
    console.log('Invalid response format:', data);
    return [];
  }
  
  const text = data.content[0].text;
  
  // Split by newlines and clean each tweet
  const tweets = text
    .split('\n')
    .filter(tweet => tweet.trim().length > 0)
    .filter(tweet => !tweet.toLowerCase().includes('here are 3'))  // Remove header text
    .filter(tweet => !tweet.toLowerCase().includes('understood'))  // Remove acknowledgment text
    .map(tweet => 
      tweet
        .trim()
        .replace(/^["']|["']$/g, '')  // Remove quotes
        .replace(/[""]/g, '')         // Remove smart quotes
        .replace(/^\d+[\.\)]\s*/, '') // Remove numbers
    )
    .filter(tweet => tweet.length <= 280);
  
  console.log('Final parsed tweets:', tweets);
  
  // Only return if we have exactly 3 tweets
  return tweets.length === 3 ? tweets : [];
};

const generateTweets = async (text, showAuthFeatures) => {
  try {
    const maxTokens = showAuthFeatures ? 800 : 300;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    while (retryCount < MAX_RETRIES) {
      const requestBody = {
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,  // Fresh token count for each attempt
        system: showAuthFeatures ? 
          'Generate exactly 3 unique tweets. Each tweet should have: 1) Informative content (max 200 chars), 2) optionally followed by 0-3 relevant hashtags only if they add value to the tweet. Example formats: "AI is transforming healthcare with personalized treatment plans #AIHealth" or "New study shows remote work increases productivity by 22% #RemoteWork #Productivity #WorkCulture" or "Breaking: Tech startup launches revolutionary quantum computing platform". Each tweet on new line.' :
          'Generate exactly 3 unique tweets. Each tweet under 280 characters. Use complete sentences. No hashtags. Keep responses brief. Each tweet on new line.',
        messages: [{
          role: 'user',
          content: retryCount === 0 ? text : 
            `${text}\n\nPrevious attempt failed. Please generate exactly 3 tweets, each under 280 characters. Be more concise.`
        }]
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.type === 'error' && data.error?.type === 'overloaded_error') {
        throw new Error('Service is temporarily busy. Please try again in a few moments.');
      }

      const tweets = parseTweetsFromResponse(data);
      
      if (tweets.length === 3 && tweets.every(tweet => tweet.length <= 280)) {
        console.log('Successfully generated 3 valid tweets');
        return tweets;
      }

      console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      console.log('Current tweets:', tweets.map(t => ({ length: t.length, content: t })));
      retryCount++;
    }
    
    throw new Error('Failed to generate valid tweets after multiple attempts. Please try again.');
  } catch (error) {
    console.error('Error generating tweets:', error);
    throw error;
  }
};

// Update the route handler to handle the error
//leave this alone api/generate is fine
app.post('/api/generate', async (req, res) => {
  const { text, showAuthFeatures } = req.body;
  
  try {
    const tweets = await generateTweets(text, showAuthFeatures);
    console.log('Sending tweets to client:', tweets); // Add debug log
    
    if (!tweets || tweets.length !== 3) {
      throw new Error('Failed to generate exactly 3 tweets');
    }
    
    res.json(tweets);
  } catch (error) {
    console.error('Error in /api/generate:', error); //api
    res.status(503).json({ 
      error: error.message || 'Failed to generate tweets. Please try again.' 
    });
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Supabase URL:', process.env.SUPABASE_URL);
});