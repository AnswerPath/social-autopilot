import { TwitterApi } from 'twitter-api-v2';
import { supabaseAdmin } from './supabase';
import { XApiCredentials } from './x-api-service';
import { ApiErrorHandler } from './error-handling';
import { createSentimentService } from './sentiment/sentiment-service';

export interface Mention {
  id: string;
  user_id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_name?: string;
  text: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_confidence?: number;
  priority_score?: number;
  is_flagged?: boolean;
  is_replied?: boolean;
  reply_id?: string;
  reply_text?: string;
  processed_at?: string;
  created_at: string;
}

export interface MentionMonitoringConfig {
  credentials: XApiCredentials;
  userId: string;
  onMention?: (mention: Mention) => Promise<void>;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class MentionMonitoringService {
  private client: TwitterApi;
  private credentials: XApiCredentials;
  private userId: string;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private onMention?: (mention: Mention) => Promise<void>;
  private onError?: (error: Error) => void;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: MentionMonitoringConfig) {
    this.credentials = config.credentials;
    this.userId = config.userId;
    this.onMention = config.onMention;
    this.onError = config.onError;
    this.reconnectDelay = config.reconnectDelay || 5000; // 5 seconds default
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;

    this.client = new TwitterApi({
      appKey: this.credentials.apiKey,
      appSecret: this.credentials.apiKeySecret,
      accessToken: this.credentials.accessToken,
      accessSecret: this.credentials.accessTokenSecret,
    });
  }

  private pollInterval?: NodeJS.Timeout;
  private lastMentionId?: string;
  private pollDelay: number = 60000; // 1 minute default

  /**
   * Start monitoring mentions using polling (X API v2 doesn't support mention streaming)
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Mention monitoring is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.reconnectAttempts = 0;

      // Get the user's username and ID
      const me = await this.client.v2.me();
      const userId = me.data.id;
      const username = me.data.username;

      console.log(`Starting mention monitoring for @${username} (${userId})`);

      // Start polling for mentions
      await this.pollMentions(userId, username);
    } catch (error) {
      console.error('Error starting mention monitoring:', error);
      this.isRunning = false;
      
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }

      // Attempt reconnection with exponential backoff
      await this.handleReconnection();
    }
  }

  /**
   * Poll for new mentions
   */
  private async pollMentions(userId: string, username: string): Promise<void> {
    const poll = async () => {
      if (!this.isRunning) return;

      try {
        // Fetch mentions
        const mentions = await this.client.v2.userMentionTimeline(userId, {
          max_results: 10,
          since_id: this.lastMentionId,
          'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'entities'],
          'user.fields': ['username', 'name', 'public_metrics'],
          expansions: ['author_id'],
        });

        const users = mentions.includes?.users || [];
        const newMentions = mentions.data?.data || [];

        // Process new mentions (in reverse order to process oldest first)
        for (const tweet of newMentions.reverse()) {
          if (!this.isRunning) break;

          // Check if we've already processed this mention
          const { data: existing } = await supabaseAdmin
            .from('mentions')
            .select('id')
            .eq('tweet_id', tweet.id)
            .single();

          if (existing) {
            // Already processed, skip
            continue;
          }

          await this.processMention(tweet, users, username);
          
          // Update last mention ID
          if (!this.lastMentionId || tweet.id > this.lastMentionId) {
            this.lastMentionId = tweet.id;
          }
        }

        // Reset reconnect attempts on successful poll
        this.reconnectAttempts = 0;

        // Schedule next poll
        if (this.isRunning) {
          this.pollInterval = setTimeout(poll, this.pollDelay);
        }
      } catch (error) {
        console.error('Error polling mentions:', error);
        
        if (this.onError) {
          this.onError(error instanceof Error ? error : new Error(String(error)));
        }

        // Attempt reconnection
        await this.handleReconnection();
      }
    };

    // Start polling immediately
    await poll();
  }

  /**
   * Stop monitoring mentions
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = undefined;
    }

    console.log('Mention monitoring stopped');
  }

  /**
   * Process a mention and store it in the database
   */
  private async processMention(tweet: any, users: any[], username: string): Promise<void> {
    try {
      const author = users.find(
        (u: any) => u.id === tweet.author_id
      );

      // Analyze sentiment
      const sentimentService = createSentimentService();
      const sentimentAnalysis = sentimentService.analyze(tweet.text);

      const mention: Omit<Mention, 'id' | 'created_at'> = {
        user_id: this.userId,
        tweet_id: tweet.id,
        author_id: tweet.author_id,
        author_username: author?.username || 'unknown',
        author_name: author?.name,
        text: tweet.text,
        sentiment: sentimentAnalysis.sentiment,
        sentiment_confidence: sentimentAnalysis.confidence,
        is_flagged: false,
        is_replied: false,
      };

      // Store in database
      const { data: storedMention, error } = await supabaseAdmin
        .from('mentions')
        .insert(mention)
        .select()
        .single();

      if (error) {
        // If it's a duplicate key error, that's okay - we already processed it
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          console.log(`Mention ${tweet.id} already processed, skipping`);
          return;
        }
        console.error('Error storing mention:', error);
        throw error;
      }

      console.log(`Mention captured: @${mention.author_username} [${sentimentAnalysis.sentiment}] - ${mention.text.substring(0, 50)}...`);

      // Process auto-reply for this mention
      try {
        const { createAutoReplyService } = await import('./auto-reply/service');
        const autoReplyService = createAutoReplyService({ userId: this.userId });
        await autoReplyService.initialize();
        const autoReplyResult = await autoReplyService.processMention(storedMention as Mention);
        
        if (autoReplyResult.success) {
          console.log(`Auto-reply sent for mention ${storedMention.id}: ${autoReplyResult.responseText?.substring(0, 50)}...`);
        } else if (autoReplyResult.error && autoReplyResult.error !== 'No matching rule found') {
          console.log(`Auto-reply processing result: ${autoReplyResult.error}`);
        }
      } catch (autoReplyError) {
        console.error('Error processing auto-reply for mention:', autoReplyError);
        // Continue even if auto-reply fails
      }

      // Call onMention callback if provided
      if (this.onMention && storedMention) {
        await this.onMention(storedMention as Mention);
      }

      // Reset reconnect attempts on successful processing
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('Error processing mention:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Stopping mention monitoring.');
      this.isRunning = false;
      if (this.onError) {
        this.onError(new Error('Max reconnection attempts reached'));
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      if (this.isRunning) {
        console.log('Reconnecting mention monitoring...');
        await this.start();
      }
    }, delay);
  }

  /**
   * Get connection status
   */
  getStatus(): { isRunning: boolean; reconnectAttempts: number } {
    return {
      isRunning: this.isRunning,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

/**
 * Factory function to create a mention monitoring service
 */
export function createMentionMonitoringService(
  config: MentionMonitoringConfig
): MentionMonitoringService {
  return new MentionMonitoringService(config);
}

