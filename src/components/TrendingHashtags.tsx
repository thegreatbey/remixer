import { supabase } from '../api/supabase'
import { useState, useEffect } from 'react'

interface TweetData {
  hashtags: string[] | null;
}

const TrendingHashtags = () => {
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);

  const fetchTrendingHashtags = async () => {
    try {
      // Get all hashtags from public.tweets
      const { data: tweetsData, error } = await supabase
        .from('tweets')
        .select('hashtags');

      if (error) throw error;

      // Handle nullable hashtags properly
      const allHashtags = (tweetsData as TweetData[])
        ?.filter(tweet => tweet.hashtags !== null)
        .flatMap(tweet => tweet.hashtags as string[]) || [];
      
      // Add type for accumulator
      const hashtagCounts = allHashtags.reduce<Record<string, number>>((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      // Fix type for sort comparison
      const topHashtags = Object.entries(hashtagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      setTrendingHashtags(topHashtags);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTrendingHashtags();

    // Set up real-time subscription
    const subscription = supabase
      .channel('public:tweets')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'tweets' }, 
          () => {
            fetchTrendingHashtags();
          }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="overflow-hidden w-[300px]">
      <span className="inline-block animate-scroll text-gray-600 text-base whitespace-nowrap">
        {trendingHashtags.map((tag, index) => (
          <span key={index}>
            <a 
              href={`https://twitter.com/search?q=${encodeURIComponent(tag)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:underline"
            >
              {tag}
            </a>
            {index < trendingHashtags.length - 1 && <span className="mx-1"></span>}
          </span>
        ))}
      </span>
    </div>
  );
};

export default TrendingHashtags; 