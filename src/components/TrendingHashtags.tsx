import { supabase } from '../api/supabase'
import { useState, useEffect } from 'react'

interface ActivityData {
  hashtags_generated: string[] | null;
}

const TrendingHashtags = () => {
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);

  const fetchTrendingHashtags = async () => {
    try {
      // Get hashtags from public.activity table's hashtags_generated column
      const { data: activityData, error } = await supabase
        .from('activity')
        .select('hashtags_generated');

      if (error) throw error;

      // Handle nullable hashtags properly
      const allHashtags = (activityData as ActivityData[])
        ?.filter(activity => activity.hashtags_generated !== null)
        .flatMap(activity => activity.hashtags_generated as string[]) || [];
      
      // If we have no hashtags, don't display anything
      if (allHashtags.length === 0) {
        setTrendingHashtags([]);
        return;
      }
      
      // Add type for accumulator
      const hashtagCounts = allHashtags.reduce<Record<string, number>>((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      // Convert to array of [tag, count] pairs for sorting
      const hashtagPairs = Object.entries(hashtagCounts);
      
      // Sort by count in descending order
      hashtagPairs.sort((a, b) => b[1] - a[1]);
      
      // Get the count of the 5th most popular hashtag (if we have at least 5)
      const fifthPlaceCount = hashtagPairs.length >= 5 ? hashtagPairs[4][1] : 0;
      
      // Include all hashtags that have at least the same count as the 5th place
      // This properly handles ties in popularity
      const topHashtags = hashtagPairs
        .filter(([_, count]) => count >= fifthPlaceCount)
        .map(([tag, _]) => tag);
      
      // If we have more than 5 due to ties, that's fine - we'll show all tied hashtags
      // If we have fewer than 5, that's also fine - we'll only show what we have
      setTrendingHashtags(topHashtags);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setTrendingHashtags([]);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTrendingHashtags();

    // Set up real-time subscription
    const subscription = supabase
      .channel('public:activity')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'activity' }, 
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

  // Don't render anything if we have no hashtags
  if (trendingHashtags.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden w-[300px]">
      <span className="inline-block animate-scroll text-black text-base whitespace-nowrap">
        {trendingHashtags.map((tag, index) => (
          <span key={index}>
            <a 
              href={`https://twitter.com/search?q=${encodeURIComponent(tag)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:underline"
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