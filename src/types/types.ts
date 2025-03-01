// Import Json type from Supabase types
import type { Json } from './supabase';

// Start with just the current fields
export interface Tweet {
    id: string;
    content: string;
    created_at: string;
    user_id: string | null;
    source_url: string | null;
    
    // Additional fields from database
    generated_tweets: Json | null;
    generated_tweets_metrics: Json | null;
    hashtags: string[] | null;
    input_length: number | null;
    input_token_cost: number | null;
    saved_tweet_length: number | null;
    saved_tweet_token_cost: number | null;
    user_input: string | null;
    all_generated_tweets?: string | null;
}

export interface TweetMetrics {
    content: string;
    length: number;
    token_cost: number;
}
