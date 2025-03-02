import { supabase } from './supabase';

export const tweetsFromPost = async (text: string, showAuthFeatures: boolean): Promise<string[]> => {
    const maxTokens = showAuthFeatures ? 800 : 300; // Different token limits based on auth status

    // Add debugging logs
    console.log('Auth params:', { 
        showAuthFeatures,
        maxTokens,
        timestamp: new Date().toISOString()
    });

    try {
        // For Vercel deployment, we can use relative path since backend is deployed with frontend
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                text, 
                showAuthFeatures,
                maxTokens
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to generate tweets');
        }

        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};
{/*
export const insertSession = async (sessionData: SessionData) => {
    const { data, error } = await supabase
        .from('sessions')
        .insert([sessionData]);

    if (error) {
        console.error('Error inserting session:', error.message);
        return null;
    }
    return data;
};
*/}
export const signInUser = async (email: string, password: string) => {
    try {
        console.log('Attempting sign in for:', email);
        
        const { data: user, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Authentication error:', error.message);
            return null;
        }

        console.log('Sign in successful:', user);
        return user;
    } catch (e) {
        console.error('Error during sign in:', e);
        return null;
    }
};