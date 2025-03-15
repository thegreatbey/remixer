import React, { useState, useEffect } from 'react';

interface WordCaptchaProps {
  onSuccess: () => void;
}

// Dictionary of words with one letter missing
type CaptchaWord = {
  display: string;  // Word with missing letter replaced by underscore
  answer: string;   // The missing letter
  complete: string; // The complete word (for screen readers)
};

const WordCaptcha: React.FC<WordCaptchaProps> = ({ onSuccess }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [currentChallenge, setCurrentChallenge] = useState<CaptchaWord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // List of words with one letter missing
  const captchaWords: CaptchaWord[] = [
    { display: 'C_t', answer: 'a', complete: 'Cat' },
    { display: 'Do_', answer: 'g', complete: 'Dog' },
    { display: 'Hou_e', answer: 's', complete: 'House' },
    { display: '_ree', answer: 'T', complete: 'Tree' },
    { display: 'Boo_', answer: 'k', complete: 'Book' },
    { display: 'Flo_er', answer: 'w', complete: 'Flower' },
    { display: '_un', answer: 'S', complete: 'Sun' },
    { display: 'Mou_e', answer: 's', complete: 'Mouse' },
    { display: 'Rai_', answer: 'n', complete: 'Rain' },
    { display: 'Clo_d', answer: 'u', complete: 'Cloud' }
  ];

  // Generate a random challenge
  const generateChallenge = () => {
    const randomIndex = Math.floor(Math.random() * captchaWords.length);
    setCurrentChallenge(captchaWords[randomIndex]);
    setUserInput('');
    setError(null);
  };

  // Initialize with a random challenge
  useEffect(() => {
    generateChallenge();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Normalize both inputs for case-insensitive comparison
    const normalizedInput = userInput.trim().toLowerCase();
    const normalizedAnswer = currentChallenge?.answer.toLowerCase();
    
    if (normalizedInput === normalizedAnswer) {
      onSuccess();
    } else {
      setError('Incorrect answer. Please try again.');
      generateChallenge();
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">Quick Verification</h2>
      <p className="mb-4 text-center text-gray-600">
        Please complete this verification to continue as a guest user.
      </p>
      
      {currentChallenge && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <label htmlFor="captcha-input" className="block mb-2 text-gray-700">
              Type the missing letter: <span className="font-bold text-lg">{currentChallenge.display}</span>
              <span className="sr-only">The complete word is {currentChallenge.complete}</span>
            </label>
            <input
              id="captcha-input"
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              maxLength={1}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center w-16"
              aria-label={`Enter the missing letter for ${currentChallenge.complete}`}
              autoFocus
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm text-center" role="alert">
              {error}
            </div>
          )}
          
          <div className="text-center">
            <button
              type="submit"
              disabled={isSubmitting || !userInput.trim()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg"
            >
              Verify
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default WordCaptcha; 