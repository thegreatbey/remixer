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

// Validate rules structure
const validateRules = (rules) => {
  // Version check
  if (!rules.version || !rules.version.match(/^\d+\.\d+$/)) {
    throw new Error('Invalid or missing version number in rules');
  }

  const requiredFields = {
    'auth_user_rules': ['base', 'constraints', 'token_limit'],
    'guest_user_rules': ['base', 'constraints', 'token_limit'],
    'conversation_rules': ['context_handling', 'conversation_token_limit']
  };

  // Check required fields
  for (const [section, fields] of Object.entries(requiredFields)) {
    if (!rules[section]) {
      throw new Error(`Missing required section: ${section}`);
    }
    for (const field of fields) {
      if (!rules[section][field]) {
        throw new Error(`Missing required field ${field} in ${section}`);
      }
    }
  }

  // Validate constraints
  for (const userType of ['auth_user_rules', 'guest_user_rules']) {
    const constraints = rules[userType].constraints;
    if (typeof constraints.max_chars !== 'number' || constraints.max_chars <= 0) {
      throw new Error(`Invalid max_chars in ${userType}`);
    }
    if (constraints.hashtags) {
      if (typeof constraints.hashtags.allowed !== 'boolean') {
        throw new Error(`Invalid hashtags.allowed in ${userType}`);
      }
      if (constraints.hashtags.max_count && 
          (typeof constraints.hashtags.max_count !== 'number' || 
           constraints.hashtags.max_count < 0)) {
        throw new Error(`Invalid hashtags.max_count in ${userType}`);
      }
    }

    // Validate token limits
    const tokenLimit = rules[userType].token_limit;
    if (typeof tokenLimit !== 'number' || tokenLimit <= 0) {
      throw new Error(`Invalid token_limit in ${userType}`);
    }
  }

  // Validate conversation token limit
  const convLimit = rules.conversation_rules.conversation_token_limit;
  if (typeof convLimit !== 'number' || convLimit <= 0) {
    throw new Error('Invalid conversation_token_limit');
  }

  return true;
};

// Load content generation rules
const loadContentGenerationRules = () => {
  try {
    // Sanitize path
    const rulesDir = path.join(__dirname, 'content_generation_rules');
    const rulesPath = path.join(rulesDir, 'tweet_rules.json');
    const examplePath = path.join(rulesDir, 'example.tweet_rules.json');

    // Ensure paths don't escape the rules directory
    if (!rulesPath.startsWith(rulesDir) || !examplePath.startsWith(rulesDir)) {
      throw new Error('Invalid rules path');
    }

    let rules;
    if (!fs.existsSync(rulesPath)) {
      console.warn('Production rules not found, falling back to example rules');
      rules = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    } else {
      rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    }

    // Validate rules structure
    validateRules(rules);

    // Log rules loading (without sensitive details)
    console.log('Content generation rules loaded successfully:', {
      hasAuthRules: !!rules.auth_user_rules,
      hasGuestRules: !!rules.guest_user_rules,
      hasConversationRules: !!rules.conversation_rules,
      timestamp: new Date().toISOString()
    });

    return rules;
  } catch (error) {
    console.error('Error loading content generation rules:', error);
    throw new Error('Failed to load content generation rules');
  }
};

const contentRules = loadContentGenerationRules();

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
      let urlLength = 23; // Default to HTTP URL length
      if (sourceUrl) {
        if (sourceUrl.startsWith('http://')) {
          urlLength = 23; // HTTP URLs count as 23 characters
        } else if (sourceUrl.startsWith('https://')) {
          urlLength = 25; // HTTPS URLs count as 25 characters
        }
      }
      return tweet.length + urlLength <= 280;
    });
  
  console.log('Final parsed tweets:', tweets);
  
  // Check if we have the expected number of tweets based on user authentication status
  return tweets.length === expectedTweetCount ? tweets : [];
};

const generateTweets = async (text, showAuthFeatures, conversationHistory) => {
  try {
    // Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input text');
    }
    if (typeof showAuthFeatures !== 'boolean') {
      throw new Error('Invalid authentication status');
    }
    if (conversationHistory && typeof conversationHistory !== 'string') {
      throw new Error('Invalid conversation history format');
    }

    // Get the appropriate rules
    const rules = showAuthFeatures ? contentRules.auth_user_rules : contentRules.guest_user_rules;
    
    // Use token limits from rules
    const maxTokens = conversationHistory ? 
      contentRules.conversation_rules.conversation_token_limit :
      rules.token_limit;
    
    const tweetCount = showAuthFeatures ? 4 : 3; // Define tweet count based on auth status
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // Log generation attempt with rule version
    console.log('Starting tweet generation:', {
      inputLength: text.length,
      isAuthUser: showAuthFeatures,
      hasConversationHistory: !!conversationHistory,
      expectedTweetCount: tweetCount,
      rulesVersion: contentRules.version,
      tokenLimit: maxTokens,
      timestamp: new Date().toISOString()
    });

    while (retryCount < MAX_RETRIES) {
      // Validate rules exist for this user type
      if (!rules || !rules.constraints) {
        throw new Error(`Missing rules configuration for ${showAuthFeatures ? 'authenticated' : 'guest'} user`);
      }

      let systemPrompt = rules.base.replace('${count}', tweetCount);
      
      // Add examples if they exist in the rules
      if (rules.examples && rules.examples.length > 0) {
        systemPrompt += ` Example formats: ${rules.examples.map(ex => `"${ex}"`).join(' or ')}`;
      }
        
      // Add conversation context if provided
      if (conversationHistory && contentRules.conversation_rules) {
        systemPrompt += ` ${contentRules.conversation_rules.context_handling}`;
      }

      // Prepare user content based on conversation history
      let userContent = text;
      if (conversationHistory && retryCount === 0) {
        userContent = `${conversationHistory}\nUser: ${text}\n\nNow generate tweets based on this conversation context and my latest message.`;
      } else if (retryCount > 0) {
        userContent = `${text}\n\nPrevious attempt failed. Please generate exactly ${tweetCount} tweets, each under ${rules.constraints.max_chars} characters. Be more concise.`;
      }

      const requestBody = {
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userContent
        }]
      };

      // Enhanced request logging
      console.log('Sending request to Claude API:', {
        systemPromptLength: systemPrompt.length,
        userContentLength: userContent.length,
        retryCount,
        maxTokens,
        constraints: {
          maxChars: rules.constraints.max_chars,
          hashtagsAllowed: rules.constraints.hashtags?.allowed,
          maxHashtags: rules.constraints.hashtags?.max_count
        },
        timestamp: new Date().toISOString()
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
      
      if (data.type === 'error') {
        if (data.error?.type === 'overloaded_error') {
          throw new Error('Service is temporarily busy. Please try again in a few moments.');
        }
        throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
      }

      // Pass the expected tweet count to the parser
      const tweets = parseTweetsFromResponse(data, tweetCount);
      
      // Validate tweets against our rules
      const validTweets = tweets.filter(tweet => {
        const maxChars = rules.constraints.max_chars;
        const hasValidLength = tweet.length <= maxChars;
        
        // Check hashtag rules if they exist
        if (rules.constraints.hashtags) {
          const hashtags = tweet.match(/#\w+/g) || [];
          if (!rules.constraints.hashtags.allowed && hashtags.length > 0) {
            return false;
          }
          if (rules.constraints.hashtags.max_count && hashtags.length > rules.constraints.hashtags.max_count) {
            return false;
          }
        }
        
        return hasValidLength;
      });
      
      // Log validation results
      console.log('Tweet validation results:', {
        totalTweets: tweets.length,
        validTweets: validTweets.length,
        invalidTweets: tweets.length - validTweets.length,
        retryCount,
        timestamp: new Date().toISOString()
      });
      
      if (validTweets.length === tweetCount) {
        console.log(`Successfully generated ${tweetCount} valid tweets`);
        return validTweets;
      }

      console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}`);
      console.log('Current tweets:', validTweets.map(t => ({ length: t.length, content: t })));
      retryCount++;
    }
    
    throw new Error('Failed to generate valid tweets after multiple attempts. Please try again.');
  } catch (error) {
    console.error('Error generating tweets:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
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