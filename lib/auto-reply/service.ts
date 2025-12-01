import { supabaseAdmin } from '../supabase';
import { RuleEngine, AutoReplyRule, RuleMatchResult } from './rule-engine';
import { XApiService, createXApiService, XApiCredentials } from '../x-api-service';
import { getUnifiedCredentials } from '../unified-credentials';
import { decrypt } from '../encryption';
import { Mention } from '../mention-monitoring';

export interface AutoReplyServiceConfig {
  userId: string;
  credentials?: XApiCredentials;
}

export interface AutoReplyResult {
  success: boolean;
  ruleId?: string;
  responseText?: string;
  tweetId?: string;
  error?: string;
  throttled?: boolean;
}

/**
 * Service for processing mentions and generating auto-replies
 */
export class AutoReplyService {
  private userId: string;
  private ruleEngine: RuleEngine;
  private xApiService?: XApiService;
  private credentials?: XApiCredentials;

  constructor(config: AutoReplyServiceConfig) {
    this.userId = config.userId;
    this.ruleEngine = new RuleEngine();
    this.credentials = config.credentials;
    
    if (this.credentials) {
      this.xApiService = createXApiService(this.credentials);
    }
  }

  /**
   * Initialize the service by loading rules and setting up API client
   */
  async initialize(): Promise<void> {
    // Load rules from database
    await this.loadRules();

    // Initialize X API service if credentials not provided
    if (!this.xApiService && !this.credentials) {
      await this.initializeApiService();
    }
  }

  /**
   * Load rules from database
   */
  async loadRules(): Promise<void> {
    try {
      const { data: rules, error } = await supabaseAdmin
        .from('auto_reply_rules')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error loading auto-reply rules:', error);
        throw error;
      }

      this.ruleEngine.loadRules(rules || []);
      console.log(`Loaded ${rules?.length || 0} active auto-reply rules for user ${this.userId}`);
    } catch (error) {
      console.error('Failed to load auto-reply rules:', error);
      throw error;
    }
  }

  /**
   * Initialize X API service from stored credentials
   * Returns true if initialized, false if in demo mode
   */
  private async initializeApiService(): Promise<boolean> {
    try {
      const credentialsResult = await getUnifiedCredentials(this.userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        console.log('No X API credentials found, running in demo mode for auto-reply');
        return false; // Demo mode
      }

      const creds = credentialsResult.credentials;

      // Check if credentials are demo placeholders
      if (!creds.apiKey || !creds.apiKeySecret || !creds.accessToken || !creds.accessTokenSecret ||
          creds.apiKey.includes('demo_') || creds.apiKeySecret.includes('demo_') ||
          creds.accessToken.includes('demo_') || creds.accessTokenSecret.includes('demo_')) {
        console.log('Demo credentials detected, running in demo mode for auto-reply');
        return false; // Demo mode
      }

      this.credentials = {
        apiKey: creds.apiKey,
        apiKeySecret: creds.apiKeySecret,
        accessToken: creds.accessToken,
        accessTokenSecret: creds.accessTokenSecret,
        userId: this.userId,
      };

      this.xApiService = createXApiService(this.credentials);
      if (credentialsResult.migrated) {
        console.log('✅ Credentials migrated from Twitter to X API format for auto-reply');
      }
      return true; // Real mode
    } catch (error) {
      console.log('Failed to initialize X API service, running in demo mode:', error);
      return false; // Demo mode
    }
  }

  /**
   * Process a mention and generate auto-reply if rules match
   */
  async processMention(mention: Mention): Promise<AutoReplyResult> {
    try {
      // Ensure service is initialized
      let isDemoMode = false;
      if (!this.xApiService) {
        await this.loadRules();
        const initialized = await this.initializeApiService();
        isDemoMode = !initialized;
      } else {
        // Check if we're in demo mode by checking credentials
        isDemoMode = !this.credentials || 
          this.credentials.apiKey.includes('demo_') ||
          !this.credentials.apiKey;
      }

      // Match mention against rules
      const match = this.ruleEngine.matchMention(
        mention.text,
        mention.sentiment || undefined
      );

      if (!match.matched || !match.rule) {
        return {
          success: false,
          error: 'No matching rule found',
        };
      }

      // Check throttle
      const throttleStatus = this.ruleEngine.checkThrottle(match.rule, this.userId);
      if (!throttleStatus.canReply) {
        return {
          success: false,
          throttled: true,
          error: throttleStatus.reason || 'Throttled',
        };
      }

      // Generate response
      const responseText = this.ruleEngine.generateResponse(match.rule, {
        text: mention.text,
        author_username: mention.author_username,
        author_name: mention.author_name,
      });

      // In demo mode, log but don't send
      if (isDemoMode) {
        const demoTweetId = `demo-reply-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Record reply in database
        await this.recordReply(mention, match.rule, responseText, demoTweetId);

        // Log success (demo mode)
        await this.logAutoReply({
          ruleId: match.rule.id,
          mentionId: mention.id,
          responseText,
          success: true,
          tweetId: demoTweetId,
          demoMode: true,
        });

        // Record in throttle cache
        this.ruleEngine.recordReply(match.rule, this.userId);

        console.log(`[AutoReply] Demo mode: Generated reply for mention ${mention.id}: ${responseText.substring(0, 50)}...`);

        return {
          success: true,
          ruleId: match.rule.id,
          responseText,
          tweetId: demoTweetId,
        };
      }

      // Send reply via X API (real mode)
      if (!this.xApiService) {
        throw new Error('X API service not initialized');
      }

      const replyResult = await this.xApiService.replyToTweet(
        mention.tweet_id,
        responseText
      );

      if (!replyResult.success) {
        // Log error but don't throw
        await this.logAutoReply({
          ruleId: match.rule.id,
          mentionId: mention.id,
          responseText,
          success: false,
          errorMessage: replyResult.error,
        });

        return {
          success: false,
          ruleId: match.rule.id,
          responseText,
          error: replyResult.error,
        };
      }

      // Record successful reply
      await this.recordReply(mention, match.rule, responseText, replyResult.postId || '');

      // Log success
      await this.logAutoReply({
        ruleId: match.rule.id,
        mentionId: mention.id,
        responseText,
        success: true,
        tweetId: replyResult.postId,
      });

      // Record in throttle cache
      this.ruleEngine.recordReply(match.rule, this.userId);

      return {
        success: true,
        ruleId: match.rule.id,
        responseText,
        tweetId: replyResult.postId,
      };
    } catch (error) {
      console.error('Error processing mention for auto-reply:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update mention record with reply information
   */
  private async recordReply(
    mention: Mention,
    rule: AutoReplyRule,
    responseText: string,
    replyTweetId: string
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('mentions')
        .update({
          is_replied: true,
          reply_id: replyTweetId,
          reply_text: responseText,
          processed_at: new Date().toISOString(),
        })
        .eq('id', mention.id);

      if (error) {
        console.error('Error updating mention with reply:', error);
      }
    } catch (error) {
      console.error('Error recording reply:', error);
    }
  }

  /**
   * Log auto-reply execution
   */
  private async logAutoReply(log: {
    ruleId: string;
    mentionId: string;
    responseText: string;
    success: boolean;
    errorMessage?: string;
    tweetId?: string;
    demoMode?: boolean;
  }): Promise<void> {
    try {
      const insertData: any = {
        rule_id: log.ruleId,
        mention_id: log.mentionId,
        user_id: this.userId,
        response_text: log.responseText,
        sent_at: new Date().toISOString(),
        success: log.success,
        error_message: log.errorMessage,
        tweet_id: log.tweetId,
      };
      
      // Only add demo_mode if column exists (for future migration support)
      // For now, we can identify demo mode by tweet_id starting with "demo-"
      
      const { error } = await supabaseAdmin
        .from('auto_reply_logs')
        .insert(insertData);

      if (error) {
        console.error('Error logging auto-reply:', error);
      }
    } catch (error) {
      console.error('Error creating auto-reply log:', error);
    }
  }

  /**
   * Test a rule against sample text
   */
  async testRule(rule: AutoReplyRule, testText: string, sentiment?: string): Promise<RuleMatchResult> {
    return this.ruleEngine.matchMention(testText, sentiment);
  }
}

/**
 * Factory function to create an auto-reply service
 */
export function createAutoReplyService(config: AutoReplyServiceConfig): AutoReplyService {
  return new AutoReplyService(config);
}

