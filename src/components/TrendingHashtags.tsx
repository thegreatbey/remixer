import { supabase } from '../api/supabase'
import { useState, useEffect } from 'react'

// Interface for activity data from the database
interface ActivityData {
  hashtags_generated: string[] | null;
}

const TrendingHashtags = () => {
  // State to store the most popular hashtags
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);

  const fetchTrendingHashtags = async () => {
    try {
      // Retrieve hashtag data from the activity table
      // This table contains all user interactions and generated content metrics
      const { data: activityData, error } = await supabase
        .from('activity')
        .select('hashtags_generated');

      if (error) throw error;

      // Extract all hashtags from all activity records
      // This flattens the array of arrays into a single array of hashtags
      const allHashtags = (activityData as ActivityData[])
        ?.filter(activity => activity.hashtags_generated !== null)
        .flatMap(activity => activity.hashtags_generated as string[]) || [];
      
      // Skip processing if no hashtags are found
      if (allHashtags.length === 0) {
        setTrendingHashtags([]);
        return;
      }
      
      // Count the frequency of each hashtag
      // This creates a map of hashtag -> count
      const hashtagCounts = allHashtags.reduce<Record<string, number>>((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});

      // Convert the hashtag counts to a sortable array
      const hashtagPairs = Object.entries(hashtagCounts);
      
      // Sort hashtags by popularity (most used first)
      hashtagPairs.sort((a, b) => b[1] - a[1]);
      
      // Determine the threshold for inclusion in top hashtags
      // This finds the count of the 5th most popular hashtag
      const fifthPlaceCount = hashtagPairs.length >= 5 ? hashtagPairs[4][1] : 0;
      
      // Select all hashtags that meet or exceed the threshold
      // This includes all hashtags tied for 5th place or better
      const topHashtags = hashtagPairs
        .filter(([_, count]) => count >= fifthPlaceCount)
        .map(([tag, _]) => tag);
      
      // Update state with the trending hashtags
      // This may include more than 5 hashtags if there are ties
      setTrendingHashtags(topHashtags);
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      setTrendingHashtags([]);
    }
  };

  useEffect(() => {
    // Load hashtags when component mounts
    fetchTrendingHashtags();

    // Set up real-time updates when activity data changes
    // This ensures trending hashtags stay current without page refresh
    const subscription = supabase
      .channel('public:activity')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'activity' }, 
          () => {
            fetchTrendingHashtags();
          }
      )
      .subscribe();

    // Clean up subscription when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Don't render anything if no trending hashtags are available
  if (trendingHashtags.length === 0) {
    return null;
  }

  // Display the trending hashtags in a horizontally scrolling container
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