import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Configure CORS to accept requests from Netlify and localhost
const corsOptions = {
  origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:4173'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

app.use(express.json());

// Debug logging
console.log('Environment variables loaded:');
console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!process.env.SUPABASE_KEY);
console.log('CORS configured for:', corsOptions.origin);

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

const parseTweetsFromResponse = (data, expectedTweetCount = 3) => {
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
    .filter(tweet => {
      // Account for URL length in validation
      const urlLength = 25;  // Twitter's t.co URL shortener length
      return tweet.length + urlLength <= 280;
    });
  
  console.log('Final parsed tweets:', tweets);
  
  // Check if we have the expected number of tweets based on user authentication status
  return tweets.length === expectedTweetCount ? tweets : [];
};

const generateTweets = async (text, showAuthFeatures, conversationHistory) => {
  try {
    // Implement tiered token limit approach:
    // - Non-auth users: 300 tokens
    // - Auth users: 800 tokens
    // - Auth users with conversation mode: 1200 tokens
    const maxTokens = !showAuthFeatures ? 300 : 
                      (showAuthFeatures && conversationHistory) ? 1200 : 800;
    
    const tweetCount = showAuthFeatures ? 4 : 3; // Define tweet count based on auth status
    let retryCount = 0;
    const MAX_RETRIES = 3;

    while (retryCount < MAX_RETRIES) {
      // Build the system prompt based on auth status and conversation mode
      let systemPrompt = showAuthFeatures ? 
        `Generate exactly ${tweetCount} unique tweets. Each tweet should have: 1) Informative content (max 230 chars), 2) optionally followed by 0-3 relevant hashtags only if they add value to the tweet. Example formats: "AI is transforming healthcare with personalized treatment plans #AIHealth" or "New study shows remote work increases productivity by 22% #RemoteWork #Productivity #WorkCulture" or "Breaking: Tech startup launches revolutionary quantum computing platform". Each tweet on new line.` :
        `Generate exactly ${tweetCount} unique tweets. Each tweet under 280 characters. Use complete sentences. No hashtags. Keep responses brief. Each tweet on new line.`;
        
      // Add conversation context instruction if provided
      if (conversationHistory) {
        systemPrompt += ` You should take into account the conversation history provided when generating these tweets to maintain context and continuity.`;
      }

      // Prepare user content based on conversation history
      let userContent = text;
      if (conversationHistory && retryCount === 0) {
        userContent = `${conversationHistory}\nUser: ${text}\n\nNow generate tweets based on this conversation context and my latest message.`;
      } else if (retryCount > 0) {
        userContent = `${text}\n\nPrevious attempt failed. Please generate exactly ${tweetCount} tweets, each under 280 characters. Be more concise.`;
      }

      const requestBody = {
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,  // Fresh token count for each attempt
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userContent
        }]
      };

      console.log('Sending request to Claude API:', {
        systemPrompt,
        hasConversationHistory: !!conversationHistory,
        tokenLimit: maxTokens,
        userContentPreview: userContent.substring(0, 100) + (userContent.length > 100 ? '...' : '')
      });

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

      // Pass the expected tweet count to the parser
      const tweets = parseTweetsFromResponse(data, tweetCount);
      
      if (tweets.length === tweetCount && tweets.every(tweet => tweet.length <= 280)) {
        console.log(`Successfully generated ${tweetCount} valid tweets`);
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

// Update the route handler to handle the conversation mode parameter
app.post('/api/generate', async (req, res) => {
  const { text, showAuthFeatures, conversationHistory, maxTokens } = req.body;
  
  try {
    const expectedTweetCount = showAuthFeatures ? 4 : 3;
    const tweets = await generateTweets(text, showAuthFeatures, conversationHistory);
    console.log('Sending tweets to client:', tweets); // Add debug log
    
    if (!tweets || tweets.length !== expectedTweetCount) {
      throw new Error(`Failed to generate exactly ${expectedTweetCount} tweets`);
    }
    
    res.json(tweets);
  } catch (error) {
    console.error('Error in /api/generate:', error); 
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

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
  // Check if the file exists first
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found in dist directory');
    return res.status(404).send('Application not built properly');
  }
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Supabase connection configured');
});