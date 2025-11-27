import { createMentionMonitoringService, Mention } from '../mention-monitoring';
import { getTwitterCredentials } from '../database-storage';
import { decrypt } from '../encryption';

export interface MentionMonitorJobConfig {
  userId: string;
  onMention?: (mention: Mention) => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Background worker for mention monitoring
 * This can be run as a separate process or scheduled job
 */
export class MentionMonitorJob {
  private userId: string;
  private monitor: any;
  private isRunning: boolean = false;
  private onMention?: (mention: Mention) => Promise<void>;
  private onError?: (error: Error) => void;

  constructor(config: MentionMonitorJobConfig) {
    this.userId = config.userId;
    this.onMention = config.onMention;
    this.onError = config.onError;
  }

  /**
   * Initialize and start the monitoring job
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn(`Mention monitor job already running for user ${this.userId}`);
      return;
    }

    try {
      // Get user credentials
      const credentialsResult = await getTwitterCredentials(this.userId);
      if (!credentialsResult.success || !credentialsResult.credentials) {
        throw new Error(`Twitter credentials not found for user ${this.userId}`);
      }

      const creds = credentialsResult.credentials;
      
      // Decrypt credentials
      const apiKey = await decrypt(creds.encrypted_api_key);
      const apiSecret = await decrypt(creds.encrypted_api_secret);
      const accessToken = await decrypt(creds.encrypted_access_token);
      const accessSecret = await decrypt(creds.encrypted_access_secret);

      // Create monitoring service
      this.monitor = createMentionMonitoringService({
        credentials: {
          apiKey,
          apiKeySecret: apiSecret,
          accessToken,
          accessTokenSecret: accessSecret,
          userId: this.userId,
        },
        userId: this.userId,
        onMention: async (mention) => {
          console.log(`[MentionMonitorJob] New mention captured: ${mention.id}`);
          
          // Call custom handler if provided
          if (this.onMention) {
            await this.onMention(mention);
          }
        },
        onError: (error) => {
          console.error(`[MentionMonitorJob] Error for user ${this.userId}:`, error);
          
          // Call custom error handler if provided
          if (this.onError) {
            this.onError(error);
          }
        },
        reconnectDelay: 5000,
        maxReconnectAttempts: 10,
      });

      // Start monitoring
      await this.monitor.start();
      this.isRunning = true;
      
      console.log(`[MentionMonitorJob] Started monitoring for user ${this.userId}`);
    } catch (error) {
      console.error(`[MentionMonitorJob] Failed to start for user ${this.userId}:`, error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the monitoring job
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.monitor) {
        await this.monitor.stop();
      }
      this.isRunning = false;
      console.log(`[MentionMonitorJob] Stopped monitoring for user ${this.userId}`);
    } catch (error) {
      console.error(`[MentionMonitorJob] Error stopping for user ${this.userId}:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  getStatus(): { isRunning: boolean; userId: string } {
    return {
      isRunning: this.isRunning,
      userId: this.userId,
    };
  }

  /**
   * Restart the monitoring job
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}

/**
 * Factory function to create a mention monitor job
 */
export function createMentionMonitorJob(
  config: MentionMonitorJobConfig
): MentionMonitorJob {
  return new MentionMonitorJob(config);
}

