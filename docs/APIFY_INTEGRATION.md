# Hybrid Integration Guide (Apify + X API)

This document explains how to set up and use the hybrid integration in Social Autopilot, which combines Apify actors for data scraping with the official X API for posting functionality.

## Overview

The hybrid integration provides the best of both worlds:
- **Apify for Data Scraping**: Automated scraping of mentions, analytics, and content using Apify actors
- **X API for Posting**: Reliable posting functionality using the official X API
- **Seamless Integration**: Automatic service selection and fallbacks

## Architecture

### Service Selection Logic

1. **Posting Operations**: X API (primary) → Apify (fallback)
2. **Data Scraping**: Apify (primary) → X API (fallback for basic data)
3. **Analytics**: X API (primary) → Apify (fallback)
4. **Profile Data**: X API (primary) → Apify (fallback)

### Benefits

✅ **Reliable Posting**: Official X API ensures reliable content posting  
✅ **Powerful Scraping**: Apify actors provide advanced data extraction  
✅ **Automatic Fallbacks**: Seamless switching between services  
✅ **Cost Effective**: Use each service for its strengths  
✅ **Future Proof**: Easy to add new actors or switch services  

## Prerequisites

1. **Apify Account**: Sign up at [apify.com](https://apify.com)
2. **Apify API Key**: Get your API key from [Apify Console](https://console.apify.com/account/integrations)
3. **X API Credentials**: Get your X API credentials from [X Developer Portal](https://developer.twitter.com/)
4. **Specific Actor**: We use `watcher.data/search-x-by-keywords` for X data scraping

## Setup

### 1. Install Dependencies

The required libraries are already included:
```bash
npm install apify-client twitter-api-v2
```

### 2. Configure Credentials

Use the integrated settings page to configure both services:

1. Go to Settings → Integrations
2. Configure your Apify API key
3. Configure your X API credentials (API Key, API Key Secret, Access Token, Access Token Secret)
4. Test both connections

### 3. Environment Variables (Optional)

For advanced configuration, you can set these environment variables:

```env
# Apify Actor ID (defaults to watcher.data/search-x-by-keywords)
APIFY_X_SCRAPING_ACTOR_ID=watcher.data/search-x-by-keywords

# X API credentials (if not using the settings interface)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret
```

## Usage

### 1. Using the Hybrid Service

```typescript
import { createHybridService } from '@/lib/hybrid-service';

// Create and initialize the service
const hybridService = await createHybridService('your-user-id');

// Post content (uses X API)
const postResult = await hybridService.postContent('Hello, world!');
if (postResult.success) {
  console.log('Post created:', postResult.postId);
  console.log('Source:', postResult.source); // 'x-api'
}

// Get mentions (uses Apify)
const mentionsResult = await hybridService.getMentions('username', 50);
if (mentionsResult.success) {
  console.log('Mentions found:', mentionsResult.mentions.length);
  console.log('Source:', mentionsResult.source); // 'apify'
}

// Search by keywords (uses Apify)
const searchResult = await hybridService.searchXByKeywords('AI technology', 20);
if (searchResult.success) {
  console.log('Search results:', searchResult.mentions.length);
}

// Get analytics (uses X API first, falls back to Apify)
const analyticsResult = await hybridService.getAnalytics('username');
if (analyticsResult.success) {
  console.log('Followers:', analyticsResult.analytics.followers);
  console.log('Source:', analyticsResult.source); // 'x-api' or 'apify'
}
```

### 2. Service-Specific Operations

#### Apify Operations (Data Scraping)

```typescript
import { createApifyService } from '@/lib/apify-service';
import { getApifyCredentials } from '@/lib/apify-storage';

// Get user credentials
const credentialsResult = await getApifyCredentials(userId);
if (credentialsResult.success) {
  const apifyService = createApifyService(credentialsResult.credentials!);
  
  // Search X content by keywords
  const searchResult = await apifyService.searchXByKeywords('AI technology', 50);
  
  // Get mentions for a user
  const mentionsResult = await apifyService.getMentions('username', 50);
}
```

#### X API Operations (Posting)

```typescript
import { createXApiService } from '@/lib/x-api-service';
import { getXApiCredentials } from '@/lib/x-api-storage';

// Get user credentials
const credentialsResult = await getXApiCredentials(userId);
if (credentialsResult.success) {
  const xApiService = createXApiService(credentialsResult.credentials!);
  
  // Post content
  const postResult = await xApiService.postContent('Hello, world!');
  
  // Reply to a tweet
  const replyResult = await xApiService.replyToTweet('tweet_id', 'Great post!');
  
  // Get user profile
  const profileResult = await xApiService.getUserProfile('username');
}
```

## API Endpoints

### Apify Credentials
- `POST /api/settings/apify-credentials` - Store new credentials
- `GET /api/settings/apify-credentials?userId={id}` - Retrieve credentials
- `PUT /api/settings/apify-credentials` - Update credentials
- `DELETE /api/settings/apify-credentials?userId={id}` - Delete credentials
- `POST /api/settings/test-apify-connection` - Test API key validity

### X API Credentials
- `POST /api/settings/x-api-credentials` - Store new credentials
- `GET /api/settings/x-api-credentials?userId={id}` - Retrieve credentials
- `PUT /api/settings/x-api-credentials` - Update credentials
- `DELETE /api/settings/x-api-credentials?userId={id}` - Delete credentials
- `POST /api/settings/test-x-api-connection` - Test credentials validity

## Apify Actor Configuration

### Current Actor: `watcher.data/search-x-by-keywords`

This actor is specifically configured for X data scraping and supports:

**Input Parameters:**
- `keywords`: Search keywords or hashtags
- `limit`: Number of results to return
- `includeReplies`: Include reply tweets (optional)
- `includeRetweets`: Include retweets (optional)
- `language`: Language filter (optional)

**Output Format:**
```json
[
  {
    "id": "tweet_id",
    "text": "Tweet content",
    "author": "username",
    "timestamp": "2024-01-01T12:00:00Z",
    "url": "https://twitter.com/user/status/tweet_id"
  }
]
```

### Finding Alternative Actors

If you need different functionality, search the [Apify Store](https://apify.com/store) for:
- "Twitter scraper" for mentions and content
- "Social media analytics" for engagement data
- "Twitter profile" for user information

## Error Handling

The hybrid service includes comprehensive error handling:

```typescript
try {
  const result = await hybridService.postContent('Hello, world!');
  if (!result.success) {
    console.error('Posting failed:', result.error);
    console.log('Service used:', result.source);
    // Handle the error appropriately
  }
} catch (error) {
  console.error('Unexpected error:', error);
  // Handle unexpected errors
}
```

## Service Status Monitoring

Check the status of both services:

```typescript
const status = await hybridService.testConnections();
console.log('Overall status:', status.success);
console.log('Apify status:', status.apify);
console.log('X API status:', status.xApi);
```

## Security Considerations

1. **Credential Storage**: All credentials are encrypted before storing
2. **Input Validation**: All inputs are validated before processing
3. **Error Messages**: Error messages don't expose sensitive information
4. **Rate Limiting**: Built-in rate limiting for both services
5. **Service Isolation**: Each service operates independently

## Troubleshooting

### Common Issues

1. **Apify Connection Failed**
   - Verify your API key is correct
   - Check if the actor is still available
   - Ensure you have sufficient credits

2. **X API Connection Failed**
   - Verify all four credentials are correct
   - Check if your app has the required permissions
   - Ensure your app is approved for the required endpoints

3. **Service Selection Issues**
   - Check which services are configured
   - Verify the service initialization
   - Review the fallback logic

### Debug Mode

Enable debug logging:

```env
TASKMASTER_LOG_LEVEL=debug
```

## Migration from Single Service

If you're migrating from a single service approach:

1. **Add Missing Credentials**: Configure the service you weren't using
2. **Update Service Calls**: Use the hybrid service instead of individual services
3. **Test Both Services**: Ensure both services work correctly
4. **Monitor Performance**: Track which service is being used for each operation

## Future Enhancements

Potential improvements:
- **Actor Performance Monitoring**: Track actor success rates and performance
- **Automatic Actor Selection**: Choose the best actor based on requirements
- **Caching Layer**: Cache frequently requested data
- **Batch Processing**: Process multiple operations efficiently
- **Webhook Support**: Real-time updates from both services
- **Advanced Analytics**: Combine data from both services for richer insights

## Support

For issues with:
- **Hybrid Integration**: Check this documentation and the codebase
- **Apify Platform**: Visit [apify.com/support](https://apify.com/support)
- **X API**: Visit [developer.twitter.com/support](https://developer.twitter.com/support)
- **Actor-Specific Issues**: Check the actor's documentation on Apify
