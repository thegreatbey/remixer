# Tweet Generator Style Guide

## Code Organization & Comments

### 1. Navigation-Aid Comments
Comments serve as section markers for quick code navigation, not implementation details.

### 2. Component Structure
- Interfaces/Types at the top
- Props destructuring with defaults
- Logical grouping of related functionality
- Strategic whitespace between sections

### 3. TypeScript Patterns

typescript
// Calculate tweet character limits
const getCharactersRemaining = (content: string, sourceUrl?: string) => {
const urlCharCount = sourceUrl ? 20 : 0; // URLs count as 20 chars in Twitter
return 280 - (content.length + urlCharCount);
};
// Handle tweet sharing with source attribution
const handleTweetThis = (content: string, sourceUrl?: string) => {
let tweetText = content;
if (sourceUrl) {
tweetText += ${sourceUrl};
}
window.open(https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}, 'blank');
};

// Clear interface definitions
interface SavedTweetsProps {
tweets: Tweet[];
onSaveTweet?: (tweet: Tweet) => void;
isSavedList?: boolean;
sourceUrl?: string; // Optional props marked with ?
}
// Functional components with type safety
const SavedTweets: React.FC<SavedTweetsProps> = ({
tweets,
onSaveTweet,
isSavedList = false // Default values in destructuring
}) => {
// Component logic
}

### 4. Comment Philosophy
DO:
- Mark major sections for navigation
- Explain "what" not "how"
- Comment non-obvious business logic
- Use consistent formatting

DON'T:
- Comment obvious code
- Repeat what code clearly shows
- Over-document simple functions
- Add redundant section markers

### 5. State Management
- Clear state initialization
- Descriptive setter names
- Grouped related state updates
- Proper handling of optional values

### 6. Git Practices
- Semantic versioning (MAJOR.MINOR.PATCH)
- Feature-based commits
- Clear commit messages
- Proper release tagging


