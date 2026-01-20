import { ApifyClient } from 'apify-client';

export interface ApifyCredentials {
  apiKey: string;
  userId: string;
}

export interface ApifyActorRun {
  id: string;
  status: string;
  createdAt: string;
  finishedAt?: string;
  output?: any;
}

export interface ApifyPostResult {
  success: boolean;
  postId?: string;
  error?: string;
  timestamp: string;
}

export interface ApifyMentionsResult {
  success: boolean;
  mentions: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: string;
    url: string;
  }>;
  error?: string;
}

export interface ApifyAnalyticsResult {
  success: boolean;
  analytics: {
    followers: number;
    following: number;
    tweets: number;
    engagement: number;
    reach: number;
  };
  error?: string;
}

export class ApifyService {
  private client: ApifyClient;
  private credentials: ApifyCredentials;

  constructor(credentials: ApifyCredentials) {
    this.credentials = credentials;
    this.client = new ApifyClient({
      token: credentials.apiKey,
    });
  }

  /**
   * Search X content using the specified Apify actor
   * Note: This method uses the watcher.data/search-x-by-keywords actor
   */
  async searchXByKeywords(keywords: string, limit: number = 50): Promise<ApifyMentionsResult> {
    try {
      const actorId = 'watcher.data/search-x-by-keywords';
      
      const run = await this.client.actor(actorId).call({
        keywords,
        limit,
        // Add other parameters as needed for the specific actor
      });

      if (run.status === 'SUCCEEDED') {
        // Get the dataset items from the run
        const dataset = this.client.run(run.id).dataset();
        const items = await dataset.listItems();
        
        // Transform the output to match our interface
        const mentions = Array.isArray(items.items) ? items.items : [];
        return {
          success: true,
          mentions: mentions.map((mention: any) => ({
            id: mention.id || mention.tweetId || mention.url,
            text: mention.text || mention.content || mention.tweet,
            author: mention.author || mention.username || mention.user,
            timestamp: mention.timestamp || mention.createdAt || mention.date,
            url: mention.url || mention.tweetUrl || `https://twitter.com/user/status/${mention.id}`,
          })),
        };
      } else {
        return {
          success: false,
          mentions: [],
          error: `Actor run failed with status: ${run.status}`,
        };
      }
    } catch (error) {
      console.error('Apify search X by keywords error:', error);
      return {
        success: false,
        mentions: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Retrieve mentions using the specified Apify actor
   * Note: This method uses the watcher.data/search-x-by-keywords actor
   */
  async getMentions(username: string, limit: number = 50): Promise<ApifyMentionsResult> {
    try {
      const actorId = 'watcher.data/search-x-by-keywords';
      
      const run = await this.client.actor(actorId).call({
        keywords: `@${username}`,
        limit,
        // Add other parameters as needed for the specific actor
      });

      if (run.status === 'SUCCEEDED') {
        // Get the dataset items from the run
        const dataset = this.client.run(run.id).dataset();
        const items = await dataset.listItems();
        
        // Transform the output to match our interface
        const mentions = Array.isArray(items.items) ? items.items : [];
        return {
          success: true,
          mentions: mentions.map((mention: any) => ({
            id: mention.id || mention.tweetId || mention.url,
            text: mention.text || mention.content || mention.tweet,
            author: mention.author || mention.username || mention.user,
            timestamp: mention.timestamp || mention.createdAt || mention.date,
            url: mention.url || mention.tweetUrl || `https://twitter.com/user/status/${mention.id}`,
          })),
        };
      } else {
        return {
          success: false,
          mentions: [],
          error: `Actor run failed with status: ${run.status}`,
        };
      }
    } catch (error) {
      console.error('Apify get mentions error:', error);
      return {
        success: false,
        mentions: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get analytics data using Apify actors
   * Note: This is a placeholder - you'll need to specify which Apify actor to use
   */
  async getAnalytics(username: string): Promise<ApifyAnalyticsResult> {
    try {
      // TODO: Replace with actual Apify actor ID for Twitter analytics scraping
      const actorId = process.env.APIFY_TWITTER_ANALYTICS_ACTOR_ID || 'your-actor-id';
      
      const run = await this.client.actor(actorId).call({
        username,
        // Add other required parameters based on the specific actor
      });

      if (run.status === 'SUCCEEDED') {
        // Get the dataset items from the run
        const dataset = this.client.run(run.id).dataset();
        const items = await dataset.listItems();
        
        const output = items.items && items.items.length > 0 ? items.items[0] : {};
        return {
          success: true,
          analytics: {
            followers: (output as any).followers || (output as any).followersCount || 0,
            following: (output as any).following || (output as any).followingCount || 0,
            tweets: (output as any).tweets || (output as any).tweetsCount || (output as any).statusesCount || 0,
            engagement: (output as any).engagement || (output as any).engagementRate || 0,
            reach: (output as any).reach || (output as any).reachCount || 0,
          },
        };
      } else {
        return {
          success: false,
          analytics: {
            followers: 0,
            following: 0,
            tweets: 0,
            engagement: 0,
            reach: 0,
          },
          error: `Actor run failed with status: ${run.status}`,
        };
      }
    } catch (error) {
      console.error('Apify get analytics error:', error);
      return {
        success: false,
        analytics: {
          followers: 0,
          following: 0,
          tweets: 0,
          engagement: 0,
          reach: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch post analytics using dy7gIgPRMhrOrfW0f actor
   * Retrieves URLs, IDs, content, publication dates, text and engagement metrics
   */
  async getPostAnalytics(
    username: string,
    options?: {
      maxPosts?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    success: boolean;
    posts?: Array<{
      id: string;
      url: string;
      text: string;
      createdAt: string;
      likes: number;
      retweets: number;
      replies: number;
      quotes?: number;
      impressions?: number;
      clicks?: number;
    }>;
    error?: string;
  }> {
    try {
      console.log(`🔍 Fetching post analytics from Apify for username: ${username}`);
      const actorId = 'dy7gIgPRMhrOrfW0f';
      
      // Clean username (remove @ if present)
      const cleanUsername = username.replace('@', '');
      
      // Try to get actor input schema to see what parameters are expected
      let inputSchema: any = null;
      try {
        const actor = this.client.actor(actorId);
        const actorInfo = await actor.get();
        console.log(`📋 Actor info:`, {
          name: actorInfo.name,
          username: actorInfo.username,
          description: actorInfo.description?.substring(0, 200),
        });
        // Try to get the input schema if available
        if ((actorInfo as any).inputSchema) {
          inputSchema = (actorInfo as any).inputSchema;
          console.log(`📋 Actor input schema:`, JSON.stringify(inputSchema, null, 2));
        }
      } catch (schemaError) {
        console.log(`⚠️ Could not fetch actor info (this is optional):`, schemaError instanceof Error ? schemaError.message : String(schemaError));
      }
      
      // Prepare input parameters for the new actor
      // The new actor uses startUrls, twitterHandles, start, end, maxItems, etc.
      const input: any = {
        startUrls: [`https://x.com/${cleanUsername}/`],
        twitterHandles: [cleanUsername],
        customMapFunction: '(object) => { return {...object} }',
        getAboutData: false,
        getReplies: false,
        minReplyCount: 0, // Include minReplyCount as shown in example
      };

      // Add date range if provided
      // The actor appears to require dates based on the example input
      // Default to a range that includes 2025 and 2026 to capture recent tweets
      if (options?.startDate) {
        // Format date as YYYY-MM-DD
        const startDate = options.startDate instanceof Date 
          ? options.startDate.toISOString().split('T')[0]
          : options.startDate;
        input.start = startDate;
      } else {
        // Default to start of 2025 (matching the example input format)
        // This ensures we capture tweets from 2025 and 2026
        input.start = '2025-01-01';
      }

      if (options?.endDate) {
        // Format date as YYYY-MM-DD
        const endDate = options.endDate instanceof Date 
          ? options.endDate.toISOString().split('T')[0]
          : options.endDate;
        input.end = endDate;
      } else {
        // Default to end of 2026 (current year)
        input.end = '2026-12-31';
      }

      // Add maxItems parameter (corresponds to maxPosts)
      if (options?.maxPosts) {
        input.maxItems = options.maxPosts;
      } else {
        input.maxItems = 1000; // Default to 1000 items (higher than old actor)
      }
      
      console.log(`📡 Apify input parameters:`, JSON.stringify(input, null, 2));
      console.log(`📡 Calling Apify actor ${actorId} with input:`, { startUrls: input.startUrls, twitterHandles: input.twitterHandles, maxItems: input.maxItems, start: input.start, end: input.end });
      
      // Call the actor
      const run = await this.client.actor(actorId).call(input);

      console.log(`⏳ Apify actor run started. Status: ${run.status}, Run ID: ${run.id}`);

      // Wait for the run to complete (with timeout)
      let finalStatus = run.status;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)
      
      while (finalStatus !== 'SUCCEEDED' && finalStatus !== 'FAILED' && finalStatus !== 'ABORTED' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        const runInfo = await this.client.run(run.id).get();
        finalStatus = runInfo.status;
        attempts++;
        
        if (attempts % 6 === 0) { // Log every 30 seconds
          console.log(`⏳ Apify actor still running... Status: ${finalStatus}, Attempt: ${attempts}/${maxAttempts}`);
        }
      }

      if (finalStatus !== 'SUCCEEDED') {
        console.error(`❌ Apify actor run ${finalStatus}`);
        
        // Try to get run logs to check for rate limit errors
        let rateLimitError = false;
        try {
          const runLog = await this.client.run(run.id).log().get();
          const logText = runLog?.log || '';
          if (logText.includes('Rate limit') || logText.includes('rate limit') || logText.includes('upgrade your plan')) {
            rateLimitError = true;
            console.error(`⚠️ Rate limit detected in actor logs`);
          }
        } catch (logError) {
          // Ignore log fetch errors
        }
        
        return {
          success: false,
          error: rateLimitError 
            ? `Apify rate limit reached. Please upgrade your Apify plan or try again later. Run ID: ${run.id}`
            : `Actor run ${finalStatus.toLowerCase()}. Run ID: ${run.id}`,
        };
      }

      console.log(`✅ Apify actor run completed successfully. Fetching dataset...`);
      console.log(`   Run ID: ${run.id}`);
      console.log(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);

      // Get the dataset items from the run
      const dataset = this.client.run(run.id).dataset();
      
      // Get dataset info first to debug
      const datasetInfo = await dataset.get();
      console.log(`📊 Dataset info:`, {
        id: datasetInfo.id,
        itemCount: datasetInfo.itemCount,
        createdAt: datasetInfo.createdAt,
      });
      
      // Try to get all items - check if pagination is needed
      let items = await dataset.listItems({ limit: 1000 }); // Request up to 1000 items
      
      console.log(`📊 Initial fetch:`, {
        total: items.total,
        count: items.items?.length || 0,
        hasMore: items.total > (items.items?.length || 0),
      });
      
      // If total indicates more items exist but we got empty array, try without limit
      if ((!items.items || items.items.length === 0) && items.total > 0) {
        console.log(`⚠️ Dataset shows ${items.total} total items but received 0. Trying to fetch all items...`);
        items = await dataset.listItems(); // Try without explicit limit
        console.log(`📊 Fetch without limit:`, {
          total: items.total,
          count: items.items?.length || 0,
        });
      }
      
      // Also check run logs for errors and warnings even if run succeeded
      try {
        const runLog = await this.client.run(run.id).log().get();
        const logText = runLog?.log || '';
        
        // Log a sample of the run log for debugging
        if (logText) {
          const logLines = logText.split('\n');
          const last50Lines = logLines.slice(-50).join('\n');
          console.log(`📋 Last 50 lines of actor run log:`, last50Lines);
          
          // Check for common issues
          if (logText.includes('Rate limit') || logText.includes('rate limit') || logText.includes('upgrade your plan')) {
            console.warn(`⚠️ Rate limit warning detected in actor logs`);
          }
          if (logText.includes('No tweets found') || logText.includes('no results') || logText.includes('empty')) {
            console.warn(`⚠️ Actor logs indicate no tweets were found`);
          }
          if (logText.includes('error') || logText.includes('Error') || logText.includes('ERROR')) {
            console.error(`❌ Errors detected in actor logs`);
          }
        }
      } catch (logError) {
        console.log(`⚠️ Could not fetch actor run logs:`, logError instanceof Error ? logError.message : String(logError));
      }

      console.log(`📊 Apify dataset retrieved. Total items: ${items.items?.length || 0}`);
      console.log(`   Dataset metadata:`, {
        total: items.total,
        limit: items.limit,
        offset: items.offset,
        count: items.items?.length || 0,
      });

      // Check if dataset shows items exist but we didn't get them
      if (items.total > 0 && (!items.items || items.items.length === 0)) {
        console.error(`❌ Dataset inconsistency detected: total=${items.total} but items array is empty`);
        console.error(`   This may indicate a pagination issue or dataset structure change`);
        console.error(`   Run ID: ${run.id}`);
        console.error(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);
      }

      if (!items.items || items.items.length === 0) {
        console.log(`⚠️ No posts found in Apify dataset`);
        console.log(`   Username used: ${cleanUsername}`);
        console.log(`   Profile URL: https://x.com/${cleanUsername}`);
        console.log(`   Input parameters:`, JSON.stringify(input, null, 2));
        console.log(`   Run ID: ${run.id}`);
        console.log(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);
        console.log(`   Dataset total: ${items.total}`);
        
        // Check for rate limit in logs
        let rateLimitDetected = false;
        try {
          const runLog = await this.client.run(run.id).log().get();
          const logText = runLog?.log || '';
          if (logText.includes('Rate limit') || logText.includes('rate limit') || logText.includes('upgrade your plan')) {
            rateLimitDetected = true;
            console.error(`   ❌ RATE LIMIT DETECTED: Apify account has reached its rate limit`);
            console.error(`   💡 Solution: Upgrade your Apify plan or wait for the rate limit to reset`);
            console.error(`   📊 Check your Apify usage at: https://console.apify.com/account/usage`);
            return {
              success: false,
              error: 'Apify rate limit reached. Please upgrade your Apify plan or try again later. Check your usage at https://console.apify.com/account/usage',
            };
          }
        } catch (logError) {
          // Ignore log fetch errors
        }
        
        if (!rateLimitDetected) {
          console.log(`   This could mean:`);
          console.log(`   1. The profile URL is incorrect or the profile doesn't exist`);
          console.log(`   2. The profile has no public posts`);
          console.log(`   3. The profile is private or blocked`);
          console.log(`   4. X/Twitter blocked the scrape attempt`);
          console.log(`   5. Check the Apify run logs at: https://console.apify.com/actors/runs/${run.id}`);
        }
        
        return {
          success: true,
          posts: [],
        };
      }

      console.log(`📊 Found ${items.items.length} posts in Apify dataset`);
      
      // Log sample item to debug field names
      if (items.items.length > 0) {
        console.log(`📋 Sample Apify item structure:`, JSON.stringify(items.items[0], null, 2));
        console.log(`📋 Sample item keys:`, Object.keys(items.items[0]));
      }

      // Clean username for comparison (remove @ and lowercase)
      const cleanUsernameLower = username.replace('@', '').toLowerCase();
      
      // Log first item structure for debugging
      if (items.items.length > 0) {
        const firstItem = items.items[0];
        console.log(`📋 First item author info:`, {
          hasAuthor: !!firstItem.author,
          authorUserName: firstItem.author?.userName, // New actor uses userName (camelCase)
          authorScreenName: firstItem.author?.screenName,
          authorUsername: firstItem.author?.username,
          profileUrl: firstItem.profileUrl,
          postId: firstItem.postId || firstItem.id,
          allKeys: Object.keys(firstItem),
        });
      }
      
      // Filter items by author to ensure we only process tweets from the requested user
      // Apify might return retweets, replies, or other content not authored by the profile owner
      const userItems = items.items.filter((item: any) => {
        // Check author.userName first (new actor uses camelCase userName)
        if (item.author?.userName) {
          const authorUserName = String(item.author.userName).toLowerCase().replace('@', '');
          const matches = authorUserName === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.postId || item.id} filtered: author userName "${authorUserName}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Check author.screenName if available (old actor format)
        if (item.author?.screenName) {
          const authorScreenName = String(item.author.screenName).toLowerCase().replace('@', '');
          const matches = authorScreenName === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.postId || item.id} filtered: author "${authorScreenName}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Check author.username as fallback (alternative format)
        if (item.author?.username) {
          const authorUsername = String(item.author.username).toLowerCase().replace('@', '');
          const matches = authorUsername === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.postId || item.id} filtered: author username "${authorUsername}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Fallback: check profileUrl if author info not available
        if (item.profileUrl) {
          const profileUrlLower = String(item.profileUrl).toLowerCase();
          const matches = profileUrlLower.includes(`/${cleanUsernameLower}`) || profileUrlLower.includes(`/x.com/${cleanUsernameLower}`);
          if (!matches) {
            console.log(`   🔍 Item ${item.postId || item.id} filtered: profileUrl "${profileUrlLower}" doesn't match "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // If no author info, include it (since we're fetching from a specific profile URL, items should be from that profile)
        // This is more lenient to avoid filtering out valid posts when Apify doesn't include author info
        console.log(`   ✅ Item ${item.postId || item.id} included (no author info, assuming from requested profile)`);
        return true;
      });
      
      if (userItems.length < items.items.length) {
        const filteredCount = items.items.length - userItems.length;
        console.log(`🔍 Filtered out ${filteredCount} items not authored by @${username} (from ${items.items.length} total items)`);
      }
      
      if (userItems.length === 0 && items.items.length > 0) {
        console.error(`❌ WARNING: All ${items.items.length} items were filtered out by author filter!`);
        console.error(`   This might indicate:`);
        console.error(`   1. Author field structure doesn't match expected format`);
        console.error(`   2. Username mismatch (requested: ${username}, actual: check Apify run)`);
        console.error(`   3. Items are from a different profile`);
        console.error(`   Sample item keys:`, items.items[0] ? Object.keys(items.items[0]) : 'N/A');
        console.error(`   Sample item author:`, items.items[0]?.author || 'N/A');
      }
      
      // Transform the Apify output to our format
      // New actor returns: id, type, url, twitterUrl, text, fullText, likeCount, retweetCount, replyCount, quoteCount, viewCount, createdAt, etc.
      const posts = userItems.map((item: any) => {
        // Extract tweet ID - new actor uses 'id' field
        const postId = item.id || item.postId || item.tweetId || item.url?.split('/').pop() || item.postUrl?.split('/').pop() || '';
        
        // Extract URL - new actor provides both url (x.com) and twitterUrl (twitter.com)
        const url = item.url || item.twitterUrl || item.postUrl || item.tweetUrl || `https://x.com/${username}/status/${postId}`;
        
        // Extract text - new actor provides both 'text' and 'fullText' (use fullText if available, fallback to text)
        const text = item.fullText || item.text || item.postText || item.content || item.tweet || '';
        
        // Handle timestamp - new actor returns createdAt as formatted date string
        let createdAt: string;
        if (item.createdAt) {
          // Parse the date string format: "Wed Sep 24 18:06:27 +0000 2025"
          if (typeof item.createdAt === 'string') {
            // Try to parse the Twitter date format
            try {
              const parsedDate = new Date(item.createdAt);
              if (!isNaN(parsedDate.getTime())) {
                createdAt = parsedDate.toISOString();
              } else {
                createdAt = item.createdAt; // Use as-is if parsing fails
              }
            } catch {
              createdAt = item.createdAt; // Use as-is if parsing fails
            }
          } else {
            createdAt = new Date(item.createdAt).toISOString();
          }
        } else if (item.timestamp) {
          // Fallback: Convert milliseconds to ISO string
          createdAt = new Date(item.timestamp).toISOString();
        } else if (item.date) {
          createdAt = typeof item.date === 'string' ? item.date : new Date(item.date).toISOString();
        } else {
          createdAt = new Date().toISOString();
        }
        
        // Engagement metrics - new actor uses camelCase field names
        // New actor returns: likeCount, retweetCount, replyCount, quoteCount, viewCount (maps to impressions)
        // Support both new format and fallback to old format for backward compatibility
        const likes = item.likeCount || item.favouriteCount || item.likes || item.favoriteCount || item.engagement?.likes || 0;
        const retweets = item.retweetCount || item.repostCount || item.retweets || item.engagement?.retweets || 0;
        const replies = item.replyCount || item.replies || item.engagement?.replies || 0;
        const quotes = item.quoteCount || item.quotes || item.engagement?.quotes || 0;
        // viewCount maps to impressions
        const impressions = item.viewCount || item.impressions || item.impressionCount || item.views || item.engagement?.impressions || undefined;
        const clicks = item.clicks || item.clickCount || item.engagement?.clicks || undefined; // Check for clicks if available

        return {
          id: String(postId),
          url: String(url),
          text: String(text),
          createdAt: String(createdAt),
          likes: Number(likes) || 0,
          retweets: Number(retweets) || 0,
          replies: Number(replies) || 0,
          quotes: Number(quotes) || 0,
          impressions: impressions !== undefined ? Number(impressions) : undefined,
          clicks: clicks !== undefined ? Number(clicks) : undefined, // Include clicks if available
        };
      });

      // Filter by date range if provided
      let filteredPosts = posts;
      if (options?.startDate || options?.endDate) {
        console.log(`📅 Filtering posts by date range:`, {
          startDate: options.startDate?.toISOString(),
          endDate: options.endDate?.toISOString(),
          totalPosts: posts.length
        });
        
        const beforeFilter = posts.length;
        filteredPosts = posts.filter((post) => {
          const postDate = new Date(post.createdAt);
          if (options.startDate && postDate < options.startDate) {
            console.log(`   ❌ Post ${post.id} filtered out: ${postDate.toISOString()} < ${options.startDate.toISOString()}`);
            return false;
          }
          if (options.endDate && postDate > options.endDate) {
            console.log(`   ❌ Post ${post.id} filtered out: ${postDate.toISOString()} > ${options.endDate.toISOString()}`);
            return false;
          }
          return true;
        });
        const afterFilter = filteredPosts.length;
        console.log(`📅 Filtered to ${afterFilter} posts within date range (from ${beforeFilter} total)`);
        
        if (afterFilter === 0 && beforeFilter > 0) {
          console.error(`❌ WARNING: All ${beforeFilter} posts were filtered out by date range!`);
          console.error(`   Date range: ${options.startDate?.toISOString()} to ${options.endDate?.toISOString()}`);
          if (posts.length > 0) {
            const samplePost = posts[0];
            console.error(`   Sample post date: ${samplePost.createdAt}`);
            console.error(`   This might indicate the date range is too restrictive or post dates are incorrect`);
          }
        }
      }

      if (filteredPosts.length === 0 && items.items.length > 0) {
        console.error(`❌ ERROR: Apify returned ${items.items.length} items but all were filtered out!`);
        console.error(`   Items before author filter: ${items.items.length}`);
        console.error(`   Items after author filter: ${userItems.length}`);
        console.error(`   Posts after date filter: ${filteredPosts.length}`);
        console.error(`   This suggests a filtering issue. Check logs above for details.`);
      }

      console.log(`✅ Successfully fetched ${filteredPosts.length} posts from Apify`);
      return {
        success: true,
        posts: filteredPosts,
      };
    } catch (error) {
      console.error('❌ Apify get post analytics error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fetch post analytics from a specific Apify run ID (useful for retrying failed stores)
   * Reading from datasets is usually free and doesn't count against usage limits
   */
  async getPostAnalyticsFromRun(
    runId: string,
    username: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    success: boolean;
    posts?: Array<{
      id: string;
      url: string;
      text: string;
      createdAt: string;
      likes: number;
      retweets: number;
      replies: number;
      quotes?: number;
      impressions?: number;
    }>;
    error?: string;
  }> {
    try {
      // Clean and validate run ID
      // Extract from URL if provided (e.g., "https://console.apify.com/actors/runs/hv2W0bikTzwMTGQpX")
      let cleanRunId = runId.trim();
      const urlMatch = cleanRunId.match(/runs\/([a-zA-Z0-9]+)/);
      if (urlMatch) {
        cleanRunId = urlMatch[1];
        console.log(`📋 Extracted run ID from URL: ${cleanRunId}`);
      }
      
      // Validate run ID format (Apify run IDs are alphanumeric, typically 17-20 characters)
      if (!/^[a-zA-Z0-9]{10,30}$/.test(cleanRunId)) {
        return {
          success: false,
          error: `Invalid run ID format: "${cleanRunId}". Run IDs should be alphanumeric and 10-30 characters long.`,
        };
      }
      
      console.log(`🔍 Fetching post analytics from Apify run ID: ${cleanRunId}`);
      console.log(`   Original input: "${runId}"`);
      console.log(`   Cleaned run ID: "${cleanRunId}"`);
      
      // First, check the run status to see if it succeeded
      let runInfo: any = null;
      let defaultDatasetId: string | null = null;
      
      try {
        runInfo = await this.client.run(cleanRunId).get();
        console.log(`📋 Run info:`, {
          status: runInfo.status,
          startedAt: runInfo.startedAt,
          finishedAt: runInfo.finishedAt,
          defaultDatasetId: runInfo.defaultDatasetId,
        });
        
        if (runInfo.status !== 'SUCCEEDED') {
          return {
            success: false,
            error: `Apify run ${cleanRunId} did not succeed. Status: ${runInfo.status}. Please check the run in Apify console: https://console.apify.com/actors/runs/${cleanRunId}`,
          };
        }
        
        defaultDatasetId = runInfo.defaultDatasetId || null;
        console.log(`✅ Run ${cleanRunId} succeeded. Default dataset ID: ${defaultDatasetId || 'not available'}`);
      } catch (runError: any) {
        console.error(`❌ Error getting run info:`, runError);
        console.error(`   Error details:`, {
          message: runError?.message,
          statusCode: runError?.statusCode,
          status: runError?.status,
          code: runError?.code,
        });
        
        // Provide more helpful error message
        let errorMsg = `Failed to get run info for ${cleanRunId}. `;
        if (runError?.statusCode === 404 || runError?.status === 404) {
          errorMsg += `Run not found. Please verify the run ID is correct.`;
        } else if (runError?.statusCode === 401 || runError?.status === 401) {
          errorMsg += `Authentication failed. Please check your Apify API key.`;
        } else {
          errorMsg += `Error: ${runError instanceof Error ? runError.message : String(runError)}`;
        }
        
        return {
          success: false,
          error: errorMsg,
        };
      }
      
      // Get the dataset items from the specified run
      // Try using the default dataset ID if available, otherwise use the run's dataset method
      let dataset;
      let datasetIdToUse: string | null = null;
      
      try {
        if (defaultDatasetId) {
          datasetIdToUse = defaultDatasetId;
          console.log(`📊 Using default dataset ID from run info: ${defaultDatasetId}`);
          dataset = this.client.dataset(defaultDatasetId);
        } else {
          console.log(`📊 No default dataset ID in run info. Using run dataset method for run ${cleanRunId}`);
          dataset = this.client.run(cleanRunId).dataset();
          
          // Try to get the dataset ID from the dataset object
          try {
            const datasetInfo = await dataset.get();
            datasetIdToUse = datasetInfo.id;
            console.log(`📊 Got dataset ID from dataset object: ${datasetIdToUse}`);
          } catch (infoError) {
            console.log(`⚠️ Could not get dataset ID from dataset object:`, infoError);
          }
        }
        console.log(`✅ Successfully accessed dataset for run ${cleanRunId}`);
      } catch (datasetError: any) {
        console.error(`❌ Error accessing dataset:`, datasetError);
        console.error(`   Dataset error details:`, {
          message: datasetError?.message,
          statusCode: datasetError?.statusCode,
          status: datasetError?.status,
          code: datasetError?.code,
        });
        
        let errorMsg = `Failed to access dataset for run ${cleanRunId}. `;
        if (datasetError?.statusCode === 404 || datasetError?.status === 404) {
          errorMsg += `Dataset not found. The run may not have created a dataset.`;
        } else {
          errorMsg += `Error: ${datasetError instanceof Error ? datasetError.message : String(datasetError)}`;
        }
        
        return {
          success: false,
          error: errorMsg,
        };
      }
      
      // Try to get dataset info first
      try {
        const datasetInfo = await dataset.get();
        console.log(`📊 Dataset info:`, {
          id: datasetInfo.id,
          name: datasetInfo.name,
          itemCount: datasetInfo.itemCount,
          cleanItemCount: datasetInfo.cleanItemCount,
        });
      } catch (datasetInfoError) {
        console.log(`⚠️ Could not get dataset info (this is optional):`, datasetInfoError);
      }
      
      // Try to get all items - use different approaches
      let items: any = null;
      
      // First, try with a reasonable limit
      try {
        items = await dataset.listItems({ limit: 1000 });
        console.log(`📊 Initial fetch result:`, {
          itemsCount: items.items?.length || 0,
          total: items.total,
          limit: items.limit,
          offset: items.offset,
        });
      } catch (listError) {
        console.error(`❌ Error calling listItems with limit:`, listError);
        // Try without limit
        try {
          items = await dataset.listItems();
          console.log(`📊 Fallback fetch (no limit):`, {
            itemsCount: items.items?.length || 0,
            total: items.total,
          });
        } catch (fallbackError) {
          console.error(`❌ Error calling listItems without limit:`, fallbackError);
          // Try with offset 0 explicitly
          try {
            items = await dataset.listItems({ offset: 0, limit: 100 });
            console.log(`📊 Fallback fetch (with offset 0):`, {
              itemsCount: items.items?.length || 0,
              total: items.total,
            });
          } catch (offsetError) {
            console.error(`❌ Error calling listItems with offset:`, offsetError);
            throw offsetError;
          }
        }
      }
      
      // If we got items but the array is empty, try fetching with pagination
      if (items && items.total > 0 && (!items.items || items.items.length === 0)) {
        console.log(`⚠️ Dataset shows ${items.total} total items but received 0. Trying pagination...`);
        try {
          // Try fetching with smaller chunks
          const allItems: any[] = [];
          let offset = 0;
          const pageSize = 50; // Smaller page size
          
          while (allItems.length < items.total && offset < items.total + 100) {
            try {
              const page = await dataset.listItems({ offset, limit: pageSize });
              console.log(`📊 Pagination attempt at offset ${offset}:`, {
                itemsInPage: page.items?.length || 0,
                total: page.total,
                hasItems: !!page.items,
              });
              
              if (page.items && page.items.length > 0) {
                allItems.push(...page.items);
                offset += page.items.length;
                console.log(`📊 Fetched page: ${allItems.length}/${items.total} items so far`);
                
                // If we got fewer items than requested, we're done
                if (page.items.length < pageSize) {
                  break;
                }
              } else {
                // No items in this page, try next offset
                offset += pageSize;
                // But don't loop forever
                if (offset > items.total * 2) {
                  console.log(`⚠️ Stopping pagination - offset too high`);
                  break;
                }
              }
            } catch (pageError) {
              console.error(`❌ Error fetching page at offset ${offset}:`, pageError);
              offset += pageSize; // Try next page
              if (offset > items.total * 2) {
                break;
              }
            }
          }
          
          if (allItems.length > 0) {
            items.items = allItems;
            items.total = allItems.length;
            console.log(`✅ Successfully fetched ${allItems.length} items via pagination`);
          } else {
            console.error(`❌ Pagination found no items despite total=${items.total}`);
          }
        } catch (paginationError) {
          console.error(`❌ Error with pagination:`, paginationError);
        }
      }
      
      // Final check: if dataset info says we have items but listItems returned empty, 
      // try accessing the dataset by ID directly
      if (items && (!items.items || items.items.length === 0) && items.total === 0) {
        console.log(`⚠️ Dataset appears empty. Double-checking with dataset info...`);
        try {
          const datasetInfo = await dataset.get();
          console.log(`📊 Dataset info re-check:`, {
            itemCount: datasetInfo.itemCount,
            cleanItemCount: datasetInfo.cleanItemCount,
          });
          
          // If dataset info shows items but listItems doesn't, there might be a sync issue
          if (datasetInfo.itemCount > 0 || datasetInfo.cleanItemCount > 0) {
            const actualCount = datasetInfo.itemCount || datasetInfo.cleanItemCount || 0;
            console.log(`⚠️ Dataset info shows ${actualCount} items but listItems returned 0. This might be a timing/sync issue.`);
            items.total = actualCount;
          }
        } catch (infoError) {
          console.log(`⚠️ Could not re-check dataset info:`, infoError);
        }
      }
      
      // If dataset is empty, try checking the run's key-value store or output
      if ((!items.items || items.items.length === 0) && items.total === 0) {
        console.log(`⚠️ Dataset is empty. Checking alternative storage methods...`);
        
        try {
          // Try key-value store
          const keyValueStore = this.client.run(cleanRunId).keyValueStore();
          const keyValueInfo = await keyValueStore.get();
          console.log(`📊 Key-value store info:`, {
            id: keyValueInfo.id,
            name: keyValueInfo.name,
            recordCount: keyValueInfo.recordCount,
          });
          
          if (keyValueInfo.recordCount > 0) {
            console.log(`📊 Found ${keyValueInfo.recordCount} records in key-value store. Trying to get records...`);
            // Try to get records from key-value store
            const records = await keyValueStore.listKeys();
            console.log(`📊 Key-value store keys:`, records.items?.slice(0, 10).map((k: any) => k.key));
            
            // Try to get the first record to see the structure
            if (records.items && records.items.length > 0) {
              const firstKey = records.items[0].key;
              const firstRecord = await keyValueStore.getRecord(firstKey);
              console.log(`📊 Sample key-value record (key: ${firstKey}):`, JSON.stringify(firstRecord?.value, null, 2));
            }
          }
        } catch (kvError) {
          console.log(`⚠️ Could not access key-value store (this is optional):`, kvError);
        }
        
        // Check run output/result
        try {
          const runOutput = runInfo?.output;
          if (runOutput) {
            console.log(`📊 Run output found:`, {
              type: typeof runOutput,
              isArray: Array.isArray(runOutput),
              length: Array.isArray(runOutput) ? runOutput.length : 'N/A',
            });
            if (Array.isArray(runOutput) && runOutput.length > 0) {
              console.log(`📊 Sample run output item:`, JSON.stringify(runOutput[0], null, 2));
            }
          }
        } catch (outputError) {
          console.log(`⚠️ Could not access run output:`, outputError);
        }
      }

      // Log sample item structure if we have items
      if (items.items && items.items.length > 0) {
        console.log(`📋 Sample item structure:`, JSON.stringify(items.items[0], null, 2));
        console.log(`📋 Sample item keys:`, Object.keys(items.items[0]));
      }

      if (!items.items || items.items.length === 0) {
        // Provide more helpful error message
        let errorMsg = `No posts found in Apify run ${cleanRunId}. `;
        if (items.total === 0) {
          errorMsg += `The dataset is empty (total: 0). The run may have completed but found no posts, or the dataset was not created.`;
        } else if (items.total > 0) {
          errorMsg += `The dataset shows ${items.total} items but we couldn't retrieve them. This might be a pagination or access issue.`;
        } else {
          errorMsg += `Please check the run status in Apify console: https://console.apify.com/actors/runs/${cleanRunId}`;
        }
        
        return {
          success: false,
          error: errorMsg,
        };
      }

      // Clean username for comparison (remove @ and lowercase)
      const cleanUsernameLower = username.replace('@', '').toLowerCase();
      
      // Filter items by author to ensure we only process tweets from the requested user
      const userItems = items.items.filter((item: any) => {
        if (item.author?.screenName) {
          const authorScreenName = String(item.author.screenName).toLowerCase().replace('@', '');
          return authorScreenName === cleanUsernameLower;
        }
        if (item.author?.username) {
          const authorUsername = String(item.author.username).toLowerCase().replace('@', '');
          return authorUsername === cleanUsernameLower;
        }
        if (item.profileUrl) {
          const profileUrlLower = String(item.profileUrl).toLowerCase();
          return profileUrlLower.includes(`/${cleanUsernameLower}`) || profileUrlLower.includes(`/x.com/${cleanUsernameLower}`);
        }
        return true; // Include if no author info (shouldn't happen, but be safe)
      });
      
      if (userItems.length < items.items.length) {
        const filteredCount = items.items.length - userItems.length;
        console.log(`🔍 Filtered out ${filteredCount} items not authored by @${username} (from ${items.items.length} total items)`);
      }

      // Transform the Apify output to our format (same logic as getPostAnalytics)
      const posts = userItems.map((item: any) => {
        const postId = item.postId || item.id || item.tweetId || item.url?.split('/').pop() || item.postUrl?.split('/').pop() || '';
        const url = item.postUrl || item.url || item.tweetUrl || `https://x.com/${username}/status/${postId}`;
        const text = item.postText || item.text || item.content || item.tweet || '';
        
        // Handle timestamp
        let createdAt: string;
        if (item.timestamp) {
          createdAt = new Date(item.timestamp).toISOString();
        } else if (item.createdAt) {
          createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date(item.createdAt).toISOString();
        } else if (item.date) {
          createdAt = typeof item.date === 'string' ? item.date : new Date(item.date).toISOString();
        } else if (item.publishedAt) {
          createdAt = typeof item.publishedAt === 'string' ? item.publishedAt : new Date(item.publishedAt).toISOString();
        } else {
          createdAt = new Date().toISOString();
        }
        
        // Engagement metrics
        const likes = item.favouriteCount || item.likes || item.likeCount || item.favoriteCount || item.engagement?.likes || 0;
        const retweets = item.retweets || item.retweetCount || item.engagement?.retweets || 0;
        const replies = item.replyCount || item.replies || item.engagement?.replies || 0;
        const quotes = item.quoteCount || item.quotes || item.engagement?.quotes || 0;
        const impressions = item.impressions || item.impressionCount || item.views || item.engagement?.impressions || undefined;

        return {
          id: String(postId),
          url: String(url),
          text: String(text),
          createdAt: String(createdAt),
          likes: Number(likes) || 0,
          retweets: Number(retweets) || 0,
          replies: Number(replies) || 0,
          quotes: Number(quotes) || 0,
          impressions: impressions !== undefined ? Number(impressions) : undefined,
        };
      });

      // Filter by date range if provided
      let filteredPosts = posts;
      if (options?.startDate || options?.endDate) {
        filteredPosts = posts.filter((post) => {
          const postDate = new Date(post.createdAt);
          if (options.startDate && postDate < options.startDate) {
            return false;
          }
          if (options.endDate && postDate > options.endDate) {
            return false;
          }
          return true;
        });
        console.log(`📅 Filtered to ${filteredPosts.length} posts within date range (from ${posts.length} total)`);
      }

      console.log(`✅ Successfully fetched ${filteredPosts.length} posts from Apify run ${cleanRunId}`);
      return {
        success: true,
        posts: filteredPosts,
      };
    } catch (error: any) {
      console.error('❌ Apify get post analytics from run error:', error);
      console.error(`   Error details:`, {
        message: error?.message,
        statusCode: error?.statusCode,
        status: error?.status,
        code: error?.code,
        stack: error?.stack?.substring(0, 200),
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get user profile information using Apify actors
   */
  async getUserProfile(username: string): Promise<any> {
    try {
      // TODO: Replace with actual Apify actor ID for Twitter profile scraping
      const actorId = process.env.APIFY_TWITTER_PROFILE_ACTOR_ID || 'your-actor-id';
      
      const run = await this.client.actor(actorId).call({
        username,
        // Add other required parameters based on the specific actor
      });

      if (run.status === 'SUCCEEDED') {
        // Get the dataset items from the run
        const dataset = this.client.run(run.id).dataset();
        const items = await dataset.listItems();
        
        return {
          success: true,
          profile: items.items && items.items.length > 0 ? items.items[0] : {},
        };
      } else {
        return {
          success: false,
          error: `Actor run failed with status: ${run.status}`,
        };
      }
    } catch (error) {
      console.error('Apify get user profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Test the Apify connection and API key validity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test the connection by getting user info
      const user = await this.client.user().get();
      return { success: true };
    } catch (error) {
      console.error('Apify connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get available actors for the current API key
   */
  async getAvailableActors(): Promise<any[]> {
    try {
      // Use the actors collection to list available actors
      const actors = await this.client.actors().list();
      return actors.items || [];
    } catch (error) {
      console.error('Failed to get available actors:', error);
      return [];
    }
  }

  /**
   * Get the last successful run ID for a specific actor
   * Useful for retrying failed stores without using more Apify credits
   */
  async getLastSuccessfulRunId(actorId: string): Promise<{ success: boolean; runId?: string; error?: string }> {
    try {
      console.log(`🔍 Finding last successful run for actor: ${actorId}`);
      
      // List recent runs for the actor
      const runs = await this.client.actor(actorId).runs().list({
        limit: 10,
        status: 'SUCCEEDED',
        desc: true, // Most recent first
      });

      if (!runs.items || runs.items.length === 0) {
        return {
          success: false,
          error: 'No successful runs found for this actor',
        };
      }

      const lastRun = runs.items[0];
      console.log(`✅ Found last successful run: ${lastRun.id} (finished at ${lastRun.finishedAt})`);
      
      return {
        success: true,
        runId: lastRun.id,
      };
    } catch (error) {
      console.error('Failed to get last successful run:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

/**
 * Factory function to create an Apify service instance
 */
export function createApifyService(credentials: ApifyCredentials): ApifyService {
  return new ApifyService(credentials);
}
