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
}

/**
 * Factory function to create an Apify service instance
 */
export function createApifyService(credentials: ApifyCredentials): ApifyService {
  return new ApifyService(credentials);
}
