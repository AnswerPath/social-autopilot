# Apify Analytics Integration

## Overview

The analytics system now supports using Apify's `delicious_zebu/advanced-x-twitter-profile-scraper` actor to fetch post analytics, avoiding X API rate limits.

## How It Works

### Service Selection Logic

1. **Check for Apify credentials first** - If Apify credentials are configured, the system will prefer Apify
2. **Get X username** - Uses X API credentials (minimal call) to get the username needed for Apify
3. **Fetch from Apify** - Calls the Apify actor to scrape post analytics
4. **Transform data** - Converts Apify output to match our `PostAnalytics` format
5. **Link to scheduled posts** - Matches tweets to scheduled posts in the database
6. **Fallback to X API** - If Apify fails or isn't configured, falls back to X API

### Apify Actor

- **Actor ID**: `delicious_zebu/advanced-x-twitter-profile-scraper`
- **Purpose**: Scrapes X profiles to retrieve URLs, IDs, content, publication dates, text, and engagement metrics
- **Input Parameters**:
  - `startUrls`: Array of X profile URLs (e.g., `["https://x.com/username/"]`) - **Required**
  - `twitterHandles`: Array of Twitter handles (e.g., `["username"]`) - **Required**
  - `start`: Start date in YYYY-MM-DD format (default: start of current year)
  - `end`: End date in YYYY-MM-DD format (default: end of current year)
  - `maxItems`: Maximum number of posts to fetch (default: 1000)
  - `getAboutData`: Whether to fetch detailed account info (default: false)
  - `getReplies`: Whether to fetch replies (default: false)
  - `customMapFunction`: Custom mapping function (optional)
- **Output**: Array of posts with engagement metrics including `viewCount` (impressions), `likeCount`, `retweetCount`, `replyCount`, `quoteCount`, `bookmarkCount`, and full tweet text

## Implementation Details

### Files Modified

1. **`lib/apify-service.ts`**
   - Added `getPostAnalytics()` method
   - Handles actor execution, waiting for completion, and data transformation
   - Supports date range filtering

2. **`lib/analytics/post-analytics-service.ts`**
   - Modified `fetchAllPostAnalytics()` to check for Apify credentials first
   - Implements Apify integration with proper error handling
   - Falls back to X API if Apify fails or isn't available

### Data Transformation

The Apify actor returns posts in its own format. We transform it to match our `PostAnalytics` interface:

```typescript
{
  post_id: string | null,      // Linked to scheduled_posts if found
  tweet_id: string,             // From Apify post ID
  user_id: string,              // Current user ID
  likes: number,                // From Apify engagement metrics
  retweets: number,             // From Apify engagement metrics
  replies: number,              // From Apify engagement metrics
  quotes: number,               // From Apify engagement metrics
  impressions?: number,         // From Apify if available
  engagement_rate?: number,     // Calculated from metrics
  collected_at: Date,           // Current timestamp
}
```

### Field Mapping

The new actor uses consistent camelCase field names. The code maps them to our database schema:

- **Post ID**: `id` (primary field)
- **URL**: `url` (x.com) or `twitterUrl` (twitter.com)
- **Text**: `fullText` (preferred) or `text` (fallback)
- **Created At**: `createdAt` (formatted date string)
- **Likes**: `likeCount` (primary) - maps to `likes`
- **Retweets**: `retweetCount` (primary) - maps to `retweets`
- **Replies**: `replyCount` (primary) - maps to `replies`
- **Quotes**: `quoteCount` (primary) - maps to `quotes`
- **Impressions**: `viewCount` (primary) - maps to `impressions`
- **Bookmarks**: `bookmarkCount` (optional, not currently stored)
- **Author**: `author.userName` (for filtering by author)

## Usage

### Prerequisites

1. **Apify Account**: Sign up at [apify.com](https://apify.com)
2. **Apify API Key**: Get from [Apify Console](https://console.apify.com/account/integrations)
3. **X API Credentials**: Still required to get your username (minimal usage)

### Configuration

1. Go to Settings → Integrations
2. Enter your Apify API key
3. Ensure X API credentials are also configured (needed for username lookup)

### Automatic Behavior

Once configured, the system will:
- Automatically use Apify when fetching analytics
- Avoid X API rate limits for analytics
- Still use X API for posting tweets
- Fall back to X API if Apify fails

## Benefits

✅ **No Rate Limits**: Apify doesn't have the same strict rate limits as X API  
✅ **More Reliable**: Better for bulk analytics operations  
✅ **Historical Data**: Can fetch more historical data  
✅ **Hybrid Approach**: Use Apify for analytics, X API for posting  

## Troubleshooting

### Apify Returns No Posts

- Check that your X username is correct
- Verify the actor is working in Apify Console
- Check Apify account credits/usage limits

### Apify Fails

- The system automatically falls back to X API
- Check server logs for detailed error messages
- Verify Apify API key is valid

### Username Not Found

- Requires X API credentials to get username
- If X API fails, Apify can't be used
- Configure both Apify and X API credentials

## Future Enhancements

- Cache Apify results to reduce API calls
- Support for multiple Apify actors
- Direct username input option (without X API)
- Batch processing for multiple users

