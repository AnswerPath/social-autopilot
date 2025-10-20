/**
 * X/Twitter Character Counter Utility
 * 
 * Implements X's specific character counting rules:
 * - URLs are counted as 23 characters (t.co shortening)
 * - Emoji are counted properly (may be multiple code points)
 * - CJK characters are counted as single characters
 */

// URL regex pattern to detect URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// Unicode ranges for emoji detection
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F0F5}]|[\u{1F200}-\u{1F2FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F251}]/gu;

// CJK character ranges
const CJK_REGEX = /[\u{4E00}-\u{9FFF}]|[\u{3400}-\u{4DBF}]|[\u{20000}-\u{2A6DF}]|[\u{2A700}-\u{2B73F}]|[\u{2B740}-\u{2B81F}]|[\u{2B820}-\u{2CEAF}]|[\u{F900}-\u{FAFF}]|[\u{2F800}-\u{2FA1F}]/gu;

/**
 * Calculate the character count according to X's rules
 * @param text The text to count characters for
 * @returns The character count as it would appear on X
 */
export function calculateXCharacterCount(text: string): number {
  if (!text) return 0;

  // Find all URLs in the text
  const urls = text.match(URL_REGEX) || [];
  const urlCount = urls.length;
  
  // Remove URLs from text for counting remaining characters
  let textWithoutUrls = text.replace(URL_REGEX, '');
  
  // Count characters in text without URLs
  // Use spread operator to properly handle emoji and CJK characters
  const characterCount = [...textWithoutUrls].length;
  
  // Add URL count (each URL counts as 23 characters on X)
  const totalCount = characterCount + (urlCount * 23);
  
  return totalCount;
}

/**
 * Get detailed breakdown of character count
 * @param text The text to analyze
 * @returns Object with character count breakdown
 */
export function getCharacterCountBreakdown(text: string): {
  totalCount: number;
  textCharacters: number;
  urlCount: number;
  urlCharacters: number;
  urls: string[];
} {
  if (!text) {
    return {
      totalCount: 0,
      textCharacters: 0,
      urlCount: 0,
      urlCharacters: 0,
      urls: []
    };
  }

  const urls = text.match(URL_REGEX) || [];
  const urlCount = urls.length;
  const urlCharacters = urlCount * 23;
  
  const textWithoutUrls = text.replace(URL_REGEX, '');
  const textCharacters = [...textWithoutUrls].length;
  
  return {
    totalCount: textCharacters + urlCharacters,
    textCharacters,
    urlCount,
    urlCharacters,
    urls
  };
}

/**
 * Check if text exceeds X's character limit
 * @param text The text to check
 * @param limit The character limit (default 280)
 * @returns True if text exceeds limit
 */
export function exceedsCharacterLimit(text: string, limit: number = 280): boolean {
  return calculateXCharacterCount(text) > limit;
}

/**
 * Get remaining characters
 * @param text The text to check
 * @param limit The character limit (default 280)
 * @returns Number of remaining characters (negative if over limit)
 */
export function getRemainingCharacters(text: string, limit: number = 280): number {
  return limit - calculateXCharacterCount(text);
}

/**
 * Get character count status for visual feedback
 * @param text The text to check
 * @param limit The character limit (default 280)
 * @returns Status object with color and message
 */
export function getCharacterCountStatus(text: string, limit: number = 280): {
  status: 'safe' | 'warning' | 'danger' | 'critical';
  color: string;
  message: string;
  percentage: number;
} {
  const count = calculateXCharacterCount(text);
  const percentage = (count / limit) * 100;
  
  if (count <= limit * 0.7) {
    return {
      status: 'safe',
      color: 'text-muted-foreground',
      message: '',
      percentage
    };
  } else if (count <= limit * 0.9) {
    return {
      status: 'warning',
      color: 'text-yellow-600',
      message: 'Approaching character limit',
      percentage
    };
  } else if (count <= limit) {
    return {
      status: 'danger',
      color: 'text-orange-600',
      message: 'Near character limit',
      percentage
    };
  } else {
    return {
      status: 'critical',
      color: 'text-red-600 font-bold',
      message: `Exceeds limit by ${count - limit} characters`,
      percentage
    };
  }
}
