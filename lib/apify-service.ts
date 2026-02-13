import { ApifyClient } from 'apify-client';
import { ApiErrorHandler, CircuitBreaker, CircuitBreakerRegistry } from '@/lib/error-handling';

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
  private circuitBreaker: CircuitBreaker;

  constructor(credentials: ApifyCredentials) {
    this.credentials = credentials;
    this.client = new ApifyClient({
      token: credentials.apiKey,
    });
    this.circuitBreaker = new CircuitBreaker();
    CircuitBreakerRegistry.getInstance().register(this.circuitBreaker);
  }

  /**
   * Shared helper: runs watcher.data/search-x-by-keywords actor, fetches dataset items,
   * and maps them to ApifyMentionsResult. Used by searchXByKeywords and getMentions.
   */
  private async fetchMentionsFromSearchActor(keywords: string, limit: number): Promise<ApifyMentionsResult> {
    const actorId = 'watcher.data/search-x-by-keywords';
    const run = await this.client.actor(actorId).call({ keywords, limit });

    if (run.status !== 'SUCCEEDED') {
      return {
        success: false,
        mentions: [],
        error: `Actor run failed with status: ${run.status}`,
      };
    }

    const dataset = this.client.run(run.id).dataset();
    const items = await dataset.listItems();
    const rawMentions = Array.isArray(items.items) ? items.items : [];

    return {
      success: true,
      mentions: rawMentions.map((mention: any) => ({
        id: mention.id || mention.tweetId || mention.url,
        text: mention.text || mention.content || mention.tweet,
        author: mention.author || mention.username || mention.user,
        timestamp: mention.timestamp || mention.createdAt || mention.date,
        url: mention.url || mention.tweetUrl || `https://twitter.com/user/status/${mention.id}`,
      })),
    };
  }

  /**
   * Search X content using the specified Apify actor
   * Note: This method uses the watcher.data/search-x-by-keywords actor
   */
  async searchXByKeywords(keywords: string, limit: number = 50): Promise<ApifyMentionsResult> {
    return this.circuitBreaker.execute(async () =>
      ApiErrorHandler.executeWithRetry(
        async () => {
          try {
            return await this.fetchMentionsFromSearchActor(keywords, limit);
          } catch (error) {
            throw ApiErrorHandler.normalizeError(error, 'apify', {
              endpoint: 'searchXByKeywords',
              userId: this.credentials.userId,
            });
          }
        },
        'apify',
        undefined,
        { endpoint: 'searchXByKeywords', userId: this.credentials.userId }
      )
    ).catch((err) => ({
      success: false as const,
      mentions: [] as ApifyMentionsResult['mentions'],
      error: err?.message ?? 'Unknown error occurred',
    }));
  }

  /**
   * Retrieve mentions using the specified Apify actor
   * Note: This method uses the watcher.data/search-x-by-keywords actor
   */
  async getMentions(username: string, limit: number = 50): Promise<ApifyMentionsResult> {
    return this.circuitBreaker.execute(async () =>
      ApiErrorHandler.executeWithRetry(
        async () => {
          try {
            return await this.fetchMentionsFromSearchActor(`@${username}`, limit);
          } catch (error) {
            throw ApiErrorHandler.normalizeError(error, 'apify', {
              endpoint: 'getMentions',
              userId: this.credentials.userId,
            });
          }
        },
        'apify',
        undefined,
        { endpoint: 'getMentions', userId: this.credentials.userId }
      )
    ).catch((err) => ({
      success: false as const,
      mentions: [] as ApifyMentionsResult['mentions'],
      error: err?.message ?? 'Unknown error occurred',
    }));
  }

  /**
   * Get analytics data using Apify actors
   * Note: This is a placeholder - you'll need to specify which Apify actor to use
   */
  async getAnalytics(username: string): Promise<ApifyAnalyticsResult> {
    const emptyAnalytics = {
      followers: 0,
      following: 0,
      tweets: 0,
      engagement: 0,
      reach: 0,
    };
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
              const actorId = process.env.APIFY_TWITTER_ANALYTICS_ACTOR_ID || 'your-actor-id';
              const run = await this.client.actor(actorId).call({ username });

              if (run.status === 'SUCCEEDED') {
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
              }
              return {
                success: false,
                analytics: emptyAnalytics,
                error: `Actor run failed with status: ${run.status}`,
              };
            } catch (error) {
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getAnalytics',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getAnalytics', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        analytics: emptyAnalytics,
        error: err?.message ?? 'Unknown error occurred',
      }));
  }

  /**
   * Fetch post analytics using delicious_zebu/advanced-x-twitter-profile-scraper actor
   * Retrieves URLs, IDs, content, publication dates, text and engagement metrics
   */
  async getPostAnalytics(
    username: string,
    options?: {
      maxPosts?: number;
      startDate?: Date | string;
      endDate?: Date | string;
      splitMode?: 'day' | 'week' | 'month';
      language?: string;
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
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
      console.log(`🔍 Fetching post analytics from Apify for username: ${username}`);
      // TODO: Update with the actual new actor ID
      // IMPORTANT: The actor we use expects `accountUrls`. If we omit it (or send the wrong field),
      // the actor may fall back to demo defaults (e.g. elonmusk, NASA).
      const actorId = process.env.APIFY_TWITTER_PROFILE_ACTOR_ID || 'delicious_zebu/advanced-x-twitter-profile-scraper';
      
      // Clean username (remove @ if present)
      const cleanUsername = username.replace('@', '');
      
      // Fetch actor input schema to understand required parameters
      let inputSchema: any = null;
      let actorInfo: any = null;
      try {
        const actor = this.client.actor(actorId);
        actorInfo = await actor.get();
        if (actorInfo) {
          console.log(`📋 Actor info:`, {
            name: actorInfo.name,
            username: actorInfo.username,
            description: actorInfo.description?.substring(0, 200),
          });
          
          // Try to get the input schema from the actor
          if ((actorInfo as any).inputSchema) {
            inputSchema = (actorInfo as any).inputSchema;
            console.log(`📋 Actor input schema found:`, JSON.stringify(inputSchema, null, 2));
          } else {
            // Try to get it from the actor's latest version
            try {
              const versions = await actor.versions().list({ limit: 1 });
              if (versions.items && versions.items.length > 0) {
                const latestVersion = versions.items[0];
                if ((latestVersion as any).inputSchema) {
                  inputSchema = (latestVersion as any).inputSchema;
                  console.log(`📋 Actor input schema from latest version:`, JSON.stringify(inputSchema, null, 2));
                }
              }
            } catch (versionError) {
              console.log(`⚠️ Could not fetch actor version info:`, versionError instanceof Error ? versionError.message : String(versionError));
            }
          }
        }
      } catch (schemaError) {
        console.log(`⚠️ Could not fetch actor info (this is optional):`, schemaError instanceof Error ? schemaError.message : String(schemaError));
      }
      
      // Prepare input parameters for the actor
      // Actor expects: accountUrls (array), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), splitMode (optional), language (optional)
      // IMPORTANT: Only include the exact fields required by the actor - do not add extra fields
      const input: {
        accountUrls: string[];
        startDate?: string;
        endDate?: string;
        splitMode?: 'day' | 'week' | 'month';
        language?: string;
      } = {
        // Required: Array of X account URLs
        // Use the user's username here to avoid actor demo defaults.
        accountUrls: [`https://x.com/${cleanUsername}`],
      };

      // Format startDate (required)
      let startDateStr: string;
      if (options?.startDate) {
        startDateStr = options.startDate instanceof Date 
          ? options.startDate.toISOString().split('T')[0]
          : options.startDate;
      } else {
        // Default to a reasonable date range (last 5 years to capture more tweets)
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        startDateStr = fiveYearsAgo.toISOString().split('T')[0];
        console.log(`📅 Using default start date (5 years ago): ${startDateStr}`);
      }
      input.startDate = startDateStr;
      if (options?.startDate) {
        console.log(`📅 Using provided start date: ${input.startDate}`);
      }

      // Format endDate (required)
      let endDateStr: string;
      if (options?.endDate) {
        endDateStr = options.endDate instanceof Date 
          ? options.endDate.toISOString().split('T')[0]
          : options.endDate;
      } else {
        // Default to today (or tomorrow to ensure we capture today's tweets)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        endDateStr = tomorrow.toISOString().split('T')[0];
        console.log(`📅 Using default end date (tomorrow): ${endDateStr}`);
      }
      input.endDate = endDateStr;
      if (options?.endDate) {
        console.log(`📅 Using provided end date: ${input.endDate}`);
      }

      // Add optional splitMode parameter (default: 'month' for fastest performance)
      if (options?.splitMode) {
        if (['day', 'week', 'month'].includes(options.splitMode)) {
          input.splitMode = options.splitMode;
          console.log(`📅 Using splitMode: ${input.splitMode}`);
        } else {
          console.warn(`⚠️ Invalid splitMode "${options.splitMode}", using default 'month'`);
          input.splitMode = 'month';
        }
      } else {
        input.splitMode = 'month'; // Default to 'month' for fastest performance
        console.log(`📅 Using default splitMode: ${input.splitMode}`);
      }

      // Add optional language parameter (default: 'any' to disable filtering)
      if (options?.language) {
        input.language = options.language;
        console.log(`🌐 Using language filter: ${input.language}`);
      } else {
        input.language = 'any'; // Default to 'any' to get all languages
        console.log(`🌐 Using default language: ${input.language} (no filtering)`);
      }
      
      // Validate date range
      if (input.startDate && input.endDate) {
        const startDateObj = new Date(input.startDate);
        const endDateObj = new Date(input.endDate);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const todayStr = todayEnd.toISOString().split('T')[0];

        if (startDateObj > endDateObj) {
          console.error(`❌ Invalid date range: start date (${input.startDate}) is after end date (${input.endDate})`);
          return {
            success: false,
            error: `Invalid date range: start date (${input.startDate}) must be before end date (${input.endDate})`,
          };
        }
        // Reject future start date: no tweets exist after today, so Apify returns demo/placeholder items
        if (startDateObj > todayEnd) {
          console.error(`❌ Invalid date range: start date (${input.startDate}) is in the future (today is ${todayStr}). The Apify actor returns demo/placeholder data when the range has no tweets.`);
          return {
            success: false,
            error: `Start date (${input.startDate}) is in the future. Use a start date on or before today (${todayStr}). The Apify actor cannot find tweets that don't exist yet and returns placeholder data when the range is empty.`,
          };
        }
        // Clamp end date to today if in the future (avoids empty/demo results from future ranges)
        // Note: end date can be up to 1 day in future (tomorrow) to capture today's tweets, but we clamp if it's further
        if (endDateObj > todayEnd) {
          const daysInFuture = Math.ceil((endDateObj.getTime() - todayEnd.getTime()) / (1000 * 60 * 60 * 24));
          if (daysInFuture > 1) {
            console.warn(`⚠️ End date (${input.endDate}) is ${daysInFuture} days in the future. Clamping to today (${todayStr}) to avoid empty/demo results.`);
            input.endDate = todayStr;
          } else {
            // Allow end date up to 1 day in future (tomorrow) to ensure we capture today's tweets
            console.log(`📅 End date (${input.endDate}) is tomorrow - allowing to capture today's tweets`);
          }
        }
        const daysDiff = Math.ceil((new Date(input.endDate).getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`📅 Date range: ${daysDiff} days (${input.startDate} to ${input.endDate})`);
      }
      
      console.log(`📡 Username being used: @${cleanUsername}`);
      console.log(`📡 Profile URL: https://x.com/${cleanUsername}`);
      
      // Log date range validation for debugging
      if (input.startDate && input.endDate) {
        const startDateObj = new Date(input.startDate);
        const endDateObj = new Date(input.endDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
        const startIsPast = startDateObj <= today;
        const endIsPast = endDateObj <= today;
        console.log(`📅 Date range validation:`, {
          start: input.startDate,
          end: input.endDate,
          daysRange: daysDiff,
          startIsPast,
          endIsPast,
          today: today.toISOString().split('T')[0],
        });
      }
      
      // Validate input before calling
      if (!cleanUsername || cleanUsername.trim().length === 0) {
        return {
          success: false,
          error: 'Invalid username provided to Apify actor. Username cannot be empty.',
        };
      }
      
      // Validate username format (should be alphanumeric, underscores, no special chars except @)
      const usernamePattern = /^[a-zA-Z0-9_]+$/;
      if (!usernamePattern.test(cleanUsername)) {
        console.error(`❌ Invalid username format: "${cleanUsername}"`);
        return {
          success: false,
          error: `Invalid username format: "${cleanUsername}". Username should only contain letters, numbers, and underscores.`,
        };
      }
      
      // Validate that accountUrls is properly formatted
      if (!input.accountUrls || !Array.isArray(input.accountUrls) || input.accountUrls.length === 0) {
        return {
          success: false,
          error: 'Invalid accountUrls: must be a non-empty array of account URLs.',
        };
      }
      
      // Ensure URLs are properly formatted
      input.accountUrls = input.accountUrls.map((url: string) => {
        // Remove trailing slash if present
        return url.replace(/\/$/, '');
      });
      
      // Explicitly remove any unwanted properties from input object before creating cleanInput
      // This prevents accountUrls, maxCollections, or any other unwanted fields from being included
      const unwantedInputKeys = ['maxCollections'];
      unwantedInputKeys.forEach(key => {
        if ((input as any)[key] !== undefined) {
          console.warn(`⚠️ Removing unwanted property '${key}' from input object before creating cleanInput`);
          delete (input as any)[key];
        }
      });
      
      // Create a clean input object with only the fields we want to send
      // This ensures no extra fields (like accountUrls, maxCollections) are accidentally included
      // startDate and endDate are guaranteed to be set (they have defaults if not provided)
      if (!input.startDate || !input.endDate) {
        return {
          success: false,
          error: 'Internal error: startDate and endDate must be set before creating clean input',
        };
      }
      
      // Explicitly create cleanInput with ONLY the allowed fields
      // Do NOT include accountUrls, maxCollections, or any other fields
      const cleanInput: {
        accountUrls: string[];
        startDate: string;
        endDate: string;
        splitMode?: 'day' | 'week' | 'month';
        language?: string;
      } = {
        accountUrls: [...input.accountUrls], // Create a new array to avoid reference issues
        startDate: input.startDate,
        endDate: input.endDate,
      };
      
      // Only add optional fields if they are set (not undefined)
      if (input.splitMode) {
        cleanInput.splitMode = input.splitMode;
      }
      if (input.language) {
        cleanInput.language = input.language;
      }
      
      // Explicitly validate that cleanInput doesn't have any unwanted properties
      const allowedKeys = ['accountUrls', 'startDate', 'endDate', 'splitMode', 'language'];
      const cleanInputKeys = Object.keys(cleanInput);
      const unwantedKeys = cleanInputKeys.filter(key => !allowedKeys.includes(key));
      if (unwantedKeys.length > 0) {
        console.error(`❌ ERROR: cleanInput contains unwanted keys: ${unwantedKeys.join(', ')}`);
        console.error(`   This should never happen. cleanInput keys:`, cleanInputKeys);
        // Remove unwanted keys
        unwantedKeys.forEach(key => {
          delete (cleanInput as any)[key];
        });
      }
      
      console.log(`✅ Input validation passed`);
      console.log(`   Username: ${cleanUsername}`);
      console.log(`   Account URLs: ${cleanInput.accountUrls.join(', ')}`);
      console.log(`   Date range: ${cleanInput.startDate} to ${cleanInput.endDate}`);
      if (cleanInput.splitMode) {
        console.log(`   Split mode: ${cleanInput.splitMode}`);
      }
      if (cleanInput.language) {
        console.log(`   Language: ${cleanInput.language}`);
      }
      
      console.log(`📡 Apify input parameters:`, JSON.stringify(cleanInput, null, 2));
      console.log(`📡 Calling Apify actor ${actorId} with clean input (no extra fields)`);
      
      // Call the actor with the clean input (only the fields we explicitly set)
      const run = await this.client.actor(actorId).call(cleanInput);

      console.log(`⏳ Apify actor run started. Status: ${run.status}, Run ID: ${run.id}`);

      // Wait for the run to complete (with timeout)
      let finalStatus = run.status;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 5 minutes (60 * 5 seconds)
      
      while (finalStatus !== 'SUCCEEDED' && finalStatus !== 'FAILED' && finalStatus !== 'ABORTED' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        const runInfo = await this.client.run(run.id).get();
        if (runInfo) {
          finalStatus = runInfo.status;
        }
        attempts++;
        
        if (attempts % 6 === 0) { // Log every 30 seconds
          console.log(`⏳ Apify actor still running... Status: ${finalStatus}, Attempt: ${attempts}/${maxAttempts}`);
        }
      }

      if (finalStatus !== 'SUCCEEDED') {
        console.error(`❌ Apify actor run ${finalStatus}`);
        
        // Get detailed error information from run logs
        let errorDetails = `Actor run ${finalStatus.toLowerCase()}`;
        let rateLimitError = false;
        let inputError = false;
        let authenticationError = false;
        
        try {
          const runLog: any = await this.client.run(run.id).log().get();
          const logText = (runLog?.log || runLog || '') as string;
          
          // Check for common error patterns
          if (logText.includes('Rate limit') || logText.includes('rate limit') || logText.includes('upgrade your plan')) {
            rateLimitError = true;
            errorDetails = 'Apify rate limit reached. Please upgrade your Apify plan or try again later.';
            console.error(`⚠️ Rate limit detected in actor logs`);
          } else if (logText.includes('Invalid input') || logText.includes('input validation') || logText.includes('required parameter')) {
            inputError = true;
            errorDetails = 'Invalid input parameters provided to actor. Check the actor documentation for required parameters.';
            console.error(`⚠️ Input validation error detected in actor logs`);
          } else if (logText.includes('Authentication') || logText.includes('401') || logText.includes('403')) {
            authenticationError = true;
            errorDetails = 'Authentication error. Please check your Apify API key.';
            console.error(`⚠️ Authentication error detected in actor logs`);
          } else if (logText.includes('No tweets found') || logText.includes('no results') || logText.includes('empty')) {
            errorDetails = 'Actor completed but found no tweets. This might indicate the profile is private, has no posts, or the date range is incorrect.';
            console.error(`⚠️ No results detected in actor logs`);
          }
          
          // Log a sample of the error log for debugging
          if (logText) {
            const logLines = logText.split('\n');
          const errorLines = logLines.filter((line: string) => 
            line.toLowerCase().includes('error') || 
            line.toLowerCase().includes('failed') ||
            line.toLowerCase().includes('exception') ||
            line.toLowerCase().includes('traceback')
          );
            if (errorLines.length > 0) {
              console.error(`📋 Error lines from actor logs:`, errorLines.slice(0, 10).join('\n'));
            }
          }
        } catch (logError) {
          console.log(`⚠️ Could not fetch actor run logs:`, logError instanceof Error ? logError.message : String(logError));
        }
        
        return {
          success: false,
          error: `${errorDetails} Run ID: ${run.id}. Check the run logs at https://console.apify.com/actors/runs/${run.id} for details.`,
        };
      }

      console.log(`✅ Apify actor run completed successfully. Fetching dataset...`);
      console.log(`   Run ID: ${run.id}`);
      console.log(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);

      // Get the dataset items from the run
      const dataset = this.client.run(run.id).dataset();
      
      // Get dataset info first to debug
      const datasetInfo = await dataset.get();
      if (datasetInfo) {
        console.log(`📊 Dataset info:`, {
          id: datasetInfo.id,
          itemCount: datasetInfo.itemCount,
          createdAt: datasetInfo.createdAt,
        });
      }
      
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
        const runLog: any = await this.client.run(run.id).log().get();
        const logText = (runLog?.log || runLog || '') as string;
        
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
        console.error(`❌ No posts found in Apify dataset`);
        console.error(`   Username used: ${cleanUsername}`);
        console.error(`   Profile URL: https://x.com/${cleanUsername}`);
        console.error(`   Input parameters:`, JSON.stringify(input, null, 2));
        console.error(`   Run ID: ${run.id}`);
        console.error(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);
        console.error(`   Dataset total: ${items.total}`);
        
        // Get detailed error information from run logs
        let errorMessage = 'No posts found in Apify dataset';
        let rateLimitDetected = false;
        let inputErrorDetected = false;
        let profileErrorDetected = false;
        
        try {
          const runLog: any = await this.client.run(run.id).log().get();
          const logText = (runLog?.log || runLog || '') as string;
          
          // Check for specific error patterns
          if (logText.includes('Rate limit') || logText.includes('rate limit') || logText.includes('upgrade your plan')) {
            rateLimitDetected = true;
            errorMessage = 'Apify rate limit reached. Please upgrade your Apify plan or wait for the rate limit to reset.';
            console.error(`   ❌ RATE LIMIT DETECTED: Apify account has reached its rate limit`);
            console.error(`   💡 Solution: Upgrade your Apify plan or wait for the rate limit to reset`);
            console.error(`   📊 Check your Apify usage at: https://console.apify.com/account/usage`);
          } else if (logText.includes('Invalid input') || logText.includes('input validation') || logText.includes('required parameter')) {
            inputErrorDetected = true;
            errorMessage = 'Invalid input parameters provided to actor. The actor may require different parameters than what was provided.';
            console.error(`   ❌ INPUT ERROR DETECTED: Actor rejected the input parameters`);
            console.error(`   💡 Solution: Check the actor documentation for required parameters`);
          } else if (logText.includes('Profile not found') || logText.includes('User not found') || logText.includes('404')) {
            profileErrorDetected = true;
            errorMessage = `Profile @${cleanUsername} not found or is invalid. Please verify the username is correct.`;
            console.error(`   ❌ PROFILE ERROR DETECTED: The profile may not exist or is invalid`);
          } else if (logText.includes('No tweets found') || logText.includes('no results') || logText.includes('empty')) {
            errorMessage = `No tweets found for @${cleanUsername}. The profile may have no public posts, be private, or the date range may be incorrect.`;
            console.error(`   ⚠️ NO RESULTS: Actor found no tweets matching the criteria`);
          } else if (logText.includes('blocked') || logText.includes('Blocked') || logText.includes('403')) {
            errorMessage = `Access to @${cleanUsername} was blocked. The profile may be private or X/Twitter blocked the scrape attempt.`;
            console.error(`   ❌ BLOCKED: Access to the profile was blocked`);
          }
          
          // Log error lines for debugging
          if (logText) {
            const logLines = logText.split('\n');
            const errorLines = logLines.filter((line: string) => 
              line.toLowerCase().includes('error') || 
              line.toLowerCase().includes('failed') ||
              line.toLowerCase().includes('exception') ||
              line.toLowerCase().includes('traceback') ||
              line.toLowerCase().includes('warning')
            );
            if (errorLines.length > 0) {
              console.error(`   📋 Error/warning lines from actor logs:`, errorLines.slice(0, 15).join('\n   '));
            }
          }
        } catch (logError) {
          console.log(`   ⚠️ Could not fetch actor run logs:`, logError instanceof Error ? logError.message : String(logError));
        }
        
        if (!rateLimitDetected && !inputErrorDetected && !profileErrorDetected) {
          console.error(`   💡 Possible causes:`);
          console.error(`   1. The profile URL is incorrect or the profile doesn't exist`);
          console.error(`   2. The profile has no public posts in the specified date range`);
          console.error(`   3. The profile is private or blocked`);
          console.error(`   4. X/Twitter blocked the scrape attempt`);
          console.error(`   5. The actor input parameters may be incorrect`);
          console.error(`   6. Check the Apify run logs at: https://console.apify.com/actors/runs/${run.id}`);
        }
        
        // Return error instead of empty success to prevent silent failures
        return {
          success: false,
          error: `${errorMessage} Run ID: ${run.id}. Check the run logs at https://console.apify.com/actors/runs/${run.id} for details.`,
        };
      }

      console.log(`📊 Found ${items.items.length} posts in Apify dataset`);
      
      // Helper: treat an item as demo/placeholder if it has demo flag or has no real post content
      const isDemoItem = (item: any): boolean =>
        item.demo === true ||
        (Object.keys(item).length === 1 && item.demo !== undefined) ||
        (!item.id && !item.postId && !item.text && !item.fullText && !item.url);

      // Log sample item to debug field names
      if (items.items.length > 0) {
        console.log(`📋 Sample Apify item structure:`, JSON.stringify(items.items[0], null, 2));
        console.log(`📋 Sample item keys:`, Object.keys(items.items[0]));
        
        // Check if items are demo/placeholder data (first item or all items)
        const firstItem = items.items[0];
        const firstItemIsDemo = isDemoItem(firstItem);
        const allItemsDemo = items.items.every((it: any) => isDemoItem(it));
        const demoCount = items.items.filter((it: any) => isDemoItem(it)).length;

        if (firstItemIsDemo || allItemsDemo || demoCount === items.items.length) {
          console.error(`❌ ERROR: Apify actor returned demo/placeholder data instead of real posts!`);
          console.error(`   ${demoCount} of ${items.items.length} items are demo placeholders.`);
          console.error(`   This usually means:`);
          console.error(`   1. The date range is in the future (no tweets exist yet) — use start/end on or before today`);
          console.error(`   2. The actor run didn't actually scrape any data`);
          console.error(`   3. The profile URL or username is incorrect`);
          console.error(`   4. The profile is private, blocked, or has no posts`);
          console.error(`   5. X/Twitter blocked the scrape attempt`);
          console.error(`   Run URL: https://console.apify.com/actors/runs/${run.id}`);
          console.error(`   Please check the Apify run logs for detailed error messages`);
          
          // Try to get run logs for more details
          try {
            const runLog: any = await this.client.run(run.id).log().get();
            const logText: string = runLog?.log ? String(runLog.log) : (runLog ? String(runLog) : '');
            if (logText) {
              const logLines = logText.split('\n');
            const errorLines = logLines.filter((line: string) => 
              line.toLowerCase().includes('error') || 
              line.toLowerCase().includes('failed') ||
              line.toLowerCase().includes('blocked') ||
              line.toLowerCase().includes('private') ||
              line.toLowerCase().includes('no posts') ||
              line.toLowerCase().includes('not found')
            );
              if (errorLines.length > 0) {
                console.error(`   Error lines from actor logs:`, errorLines.slice(0, 10).join('\n   '));
              }
            }
          } catch (logError) {
            console.error(`   Could not fetch detailed logs:`, logError instanceof Error ? logError.message : String(logError));
          }
          
          // Check if date range might be the issue
          const startDateObj = input.startDate ? new Date(input.startDate) : null;
          const endDateObj = input.endDate ? new Date(input.endDate) : null;
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          
          let hint = '';
          if (startDateObj && startDateObj > today) {
            hint = ' The start date is in the future — use a start date on or before today.';
          } else if (startDateObj && endDateObj) {
            const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
            hint = ` Date range: ${input.startDate} to ${input.endDate} (${daysDiff} days).`;
          }
          
          return {
            success: false,
            error: `Apify actor returned demo/placeholder data instead of real posts. This usually means the actor couldn't scrape the profile or found no posts in the specified date range.${hint} Check the run logs at https://console.apify.com/actors/runs/${run.id} for details. Possible causes: no posts in date range, incorrect username, private profile, X/Twitter blocking, or actor limitations.`,
          };
        }
      }

      // Clean username for comparison (remove @ and lowercase)
      const cleanUsernameLower = username.replace('@', '').toLowerCase();
      
      // Log first item structure for debugging
      if (items.items.length > 0) {
        const firstItem: any = items.items[0];
        const author = firstItem.author || {};
        console.log(`📋 First item author info:`, {
          hasAuthor: !!firstItem.author,
          authorHandle: firstItem.authorHandle, // New actor uses authorHandle directly
          authorUserName: author.userName, // Old actor uses userName (camelCase)
          authorScreenName: author.screenName,
          authorUsername: author.username,
          profileUrl: firstItem.profileUrl,
          authorUrl: firstItem.authorUrl,
          postId: firstItem.postId || firstItem.id || firstItem.tweetId,
          allKeys: Object.keys(firstItem),
        });
      }
      
      // Filter items by author to ensure we only process tweets from the requested user
      // Apify might return retweets, replies, or other content not authored by the profile owner
      const userItems = items.items.filter((item: any) => {
        // Check authorHandle first (new actor format - direct field)
        if (item.authorHandle) {
          const authorHandle = String(item.authorHandle).toLowerCase().replace('@', '');
          const matches = authorHandle === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: authorHandle "${authorHandle}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Check author.userName (old actor format)
        if (item.author?.userName) {
          const authorUserName = String(item.author.userName).toLowerCase().replace('@', '');
          const matches = authorUserName === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: author userName "${authorUserName}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Check author.screenName if available (old actor format)
        if (item.author?.screenName) {
          const authorScreenName = String(item.author.screenName).toLowerCase().replace('@', '');
          const matches = authorScreenName === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: author "${authorScreenName}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Check author.username as fallback (alternative format)
        if (item.author?.username) {
          const authorUsername = String(item.author.username).toLowerCase().replace('@', '');
          const matches = authorUsername === cleanUsernameLower;
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: author username "${authorUsername}" != "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // Fallback: check authorUrl or profileUrl if author info not available
        if (item.authorUrl) {
          const authorUrlLower = String(item.authorUrl).toLowerCase();
          const matches = authorUrlLower.includes(`/${cleanUsernameLower}`) || authorUrlLower.includes(`/x.com/${cleanUsernameLower}`);
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: authorUrl "${authorUrlLower}" doesn't match "${cleanUsernameLower}"`);
          }
          return matches;
        }
        if (item.profileUrl) {
          const profileUrlLower = String(item.profileUrl).toLowerCase();
          const matches = profileUrlLower.includes(`/${cleanUsernameLower}`) || profileUrlLower.includes(`/x.com/${cleanUsernameLower}`);
          if (!matches) {
            console.log(`   🔍 Item ${item.tweetId || item.postId || item.id} filtered: profileUrl "${profileUrlLower}" doesn't match "${cleanUsernameLower}"`);
          }
          return matches;
        }
        // If no author info, include it (since we're fetching from a specific profile URL, items should be from that profile)
        // This is more lenient to avoid filtering out valid posts when Apify doesn't include author info
        console.log(`   ✅ Item ${item.tweetId || item.postId || item.id} included (no author info, assuming from requested profile)`);
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
      // New actor returns: tweetId, authorHandle, tweetUrl, fullText, createdAt, replyCount, repostCount, likeCount, viewCount, etc.
      const posts = userItems.map((item: any) => {
        // Extract tweet ID - new actor uses 'tweetId' field, fallback to other formats
        const postId = item.tweetId || item.id || item.postId || item.url?.split('/').pop() || item.tweetUrl?.split('/').pop() || item.postUrl?.split('/').pop() || '';
        
        // Extract URL - new actor provides tweetUrl, fallback to other formats
        const url = item.tweetUrl || item.url || item.twitterUrl || item.postUrl || `https://x.com/${username}/status/${postId}`;
        
        // Extract text - new actor provides 'fullText', fallback to other formats
        const text = item.fullText || item.text || item.postText || item.content || item.tweet || '';
        
        // Handle timestamp - new actor returns createdAt as formatted date string
        let createdAt: string;
        if (item.createdAt) {
          // Parse the date string format: "2025-09-02 16:00:24+00:00" or ISO format
          if (typeof item.createdAt === 'string') {
            // Try to parse the date string
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
        // New actor returns: likeCount, repostCount (not retweetCount), replyCount, viewCount (maps to impressions)
        // Support both new format and fallback to old format for backward compatibility
        const likes = item.likeCount || item.favouriteCount || item.likes || item.favoriteCount || item.engagement?.likes || 0;
        const retweets = item.repostCount || item.retweetCount || item.retweets || item.engagement?.retweets || 0;
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
        // Convert string dates to Date objects for comparison
        const startDateObj = options.startDate 
          ? (options.startDate instanceof Date ? options.startDate : new Date(options.startDate))
          : null;
        const endDateObj = options.endDate 
          ? (options.endDate instanceof Date ? options.endDate : new Date(options.endDate))
          : null;
        
        console.log(`📅 Filtering posts by date range:`, {
          startDate: startDateObj?.toISOString(),
          endDate: endDateObj?.toISOString(),
          totalPosts: posts.length
        });
        
        const beforeFilter = posts.length;
        filteredPosts = posts.filter((post) => {
          const postDate = new Date(post.createdAt);
          if (startDateObj && postDate < startDateObj) {
            console.log(`   ❌ Post ${post.id} filtered out: ${postDate.toISOString()} < ${startDateObj.toISOString()}`);
            return false;
          }
          if (endDateObj && postDate > endDateObj) {
            console.log(`   ❌ Post ${post.id} filtered out: ${postDate.toISOString()} > ${endDateObj.toISOString()}`);
            return false;
          }
          return true;
        });
        const afterFilter = filteredPosts.length;
        console.log(`📅 Filtered to ${afterFilter} posts within date range (from ${beforeFilter} total)`);
        
        if (afterFilter === 0 && beforeFilter > 0) {
          console.error(`❌ WARNING: All ${beforeFilter} posts were filtered out by date range!`);
          console.error(`   Date range: ${startDateObj?.toISOString()} to ${endDateObj?.toISOString()}`);
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
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getPostAnalytics',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getPostAnalytics', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        error: err?.message ?? 'Unknown error occurred',
      }));
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
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
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
            if (datasetInfo) {
              datasetIdToUse = datasetInfo.id;
              console.log(`📊 Got dataset ID from dataset object: ${datasetIdToUse}`);
            }
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
        if (datasetInfo) {
          console.log(`📊 Dataset info:`, {
            id: datasetInfo.id,
            name: datasetInfo.name,
            itemCount: datasetInfo.itemCount,
            cleanItemCount: (datasetInfo as any).cleanItemCount,
          });
        }
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
          if (datasetInfo) {
            console.log(`📊 Dataset info re-check:`, {
              itemCount: datasetInfo.itemCount,
              cleanItemCount: (datasetInfo as any).cleanItemCount,
            });
            
            // If dataset info shows items but listItems doesn't, there might be a sync issue
            const cleanItemCount = (datasetInfo as any).cleanItemCount || 0;
            if (datasetInfo.itemCount > 0 || cleanItemCount > 0) {
              const actualCount = datasetInfo.itemCount || cleanItemCount || 0;
              console.log(`⚠️ Dataset info shows ${actualCount} items but listItems returned 0. This might be a timing/sync issue.`);
              items.total = actualCount;
            }
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
          const keyValueInfo: any = await keyValueStore.get();
          if (keyValueInfo) {
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
          }
        } catch (kvError) {
          console.log(`⚠️ Could not access key-value store (this is optional):`, kvError);
        }
        
        // Check run output/result
        try {
          if (runInfo) {
            const runOutput = (runInfo as any).output;
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

      // Transform the Apify output to our format (same logic as getPostAnalytics)
      // New actor uses camelCase field names: id, url, fullText/text, createdAt, likeCount, retweetCount, etc.
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
        } else if (item.publishedAt) {
          createdAt = typeof item.publishedAt === 'string' ? item.publishedAt : new Date(item.publishedAt).toISOString();
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
          // Note: clicks and bookmarkCount are not included here as they're not in the return type
          // but could be added if needed in the future
        };
      });

      // Filter by date range if provided
      let filteredPosts = posts;
      if (options?.startDate || options?.endDate) {
        filteredPosts = posts.filter((post: any) => {
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
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getPostAnalyticsFromRun',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getPostAnalyticsFromRun', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        error: err?.message ?? 'Unknown error occurred',
      }));
  }

  /**
   * Get user profile information using Apify actors
   */
  async getUserProfile(username: string): Promise<any> {
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
              const actorId = process.env.APIFY_TWITTER_PROFILE_ACTOR_ID || 'your-actor-id';
              const run = await this.client.actor(actorId).call({ username });

              if (run.status === 'SUCCEEDED') {
                const dataset = this.client.run(run.id).dataset();
                const items = await dataset.listItems();
                return {
                  success: true,
                  profile: items.items && items.items.length > 0 ? items.items[0] : {},
                };
              }
              return {
                success: false,
                error: `Actor run failed with status: ${run.status}`,
              };
            } catch (error) {
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getUserProfile',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getUserProfile', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        error: err?.message ?? 'Unknown error occurred',
      }));
  }

  /**
   * Test the Apify connection and API key validity
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
              await this.client.user().get();
              return { success: true };
            } catch (error) {
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'testConnection',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'testConnection', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        error: err?.message ?? 'Unknown error occurred',
      }));
  }

  /**
   * Get available actors for the current API key
   */
  async getAvailableActors(): Promise<any[]> {
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
              const actors = await this.client.actors().list();
              return actors.items || [];
            } catch (error) {
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getAvailableActors',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getAvailableActors', userId: this.credentials.userId }
        )
      )
      .catch((err) => {
        console.error('Failed to get available actors:', err);
        return [];
      });
  }

  /**
   * Get the last successful run ID for a specific actor
   * Useful for retrying failed stores without using more Apify credits
   */
  async getLastSuccessfulRunId(actorId: string): Promise<{ success: boolean; runId?: string; error?: string }> {
    return this.circuitBreaker
      .execute(async () =>
        ApiErrorHandler.executeWithRetry(
          async () => {
            try {
              console.log(`🔍 Finding last successful run for actor: ${actorId}`);
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
              throw ApiErrorHandler.normalizeError(error, 'apify', {
                endpoint: 'getLastSuccessfulRunId',
                userId: this.credentials.userId,
              });
            }
          },
          'apify',
          undefined,
          { endpoint: 'getLastSuccessfulRunId', userId: this.credentials.userId }
        )
      )
      .catch((err) => ({
        success: false,
        error: err?.message ?? 'Unknown error occurred',
      }));
  }
}

/**
 * Factory function to create an Apify service instance
 */
export function createApifyService(credentials: ApifyCredentials): ApifyService {
  return new ApifyService(credentials);
}
