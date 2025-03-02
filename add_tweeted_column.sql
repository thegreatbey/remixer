-- Add tweeted column to public.tweets table
ALTER TABLE public.tweets ADD COLUMN IF NOT EXISTS tweeted TEXT;

-- Ensure tweeted_tweet column exists in public.activity table
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS tweeted_tweet TEXT; 