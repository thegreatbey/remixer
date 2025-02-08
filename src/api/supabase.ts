import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cvhruzdzdadcoafqofqe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aHJ1emR6ZGFkY29hZnFvZnFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1MjkyMzYsImV4cCI6MjA1NDEwNTIzNn0.oFS6KJkSIu0zHUKTBcd2IGsTwIZ4hvocKOE49lX5mV4'

export const supabase = createClient(supabaseUrl, supabaseKey)
