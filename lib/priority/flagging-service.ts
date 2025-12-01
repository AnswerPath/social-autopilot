import { supabaseAdmin } from '../supabase';
import { PriorityScorer, createPriorityScorer } from './priority-scorer';
import { Mention } from '../mention-monitoring';

export interface FlaggingConfig {
  threshold: number; // Score threshold for flagging (0-100)
  autoFlag: boolean; // Automatically flag mentions above threshold
}

export interface FlaggedMention extends Mention {
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  flag_reasons: string[];
}

/**
 * Service for flagging mentions that require human attention
 */
export class FlaggingService {
  private scorer: PriorityScorer;
  private config: FlaggingConfig;

  constructor(config?: Partial<FlaggingConfig>) {
    this.scorer = createPriorityScorer();
    this.config = {
      threshold: 50,
      autoFlag: true,
      ...config,
    };
  }

  /**
   * Evaluate and flag a mention
   */
  async evaluateMention(mention: Mention, authorFollowers?: number): Promise<{
    flagged: boolean;
    priorityScore: number;
    priorityLevel: 'low' | 'medium' | 'high' | 'critical';
    reasons: string[];
  }> {
    // Calculate priority score
    const priorityResult = this.scorer.calculateScore({
      text: mention.text,
      sentiment: mention.sentiment,
      sentiment_confidence: mention.sentiment_confidence,
      author_followers: authorFollowers,
    });

    const shouldFlag = this.scorer.shouldFlag(priorityResult.score, this.config.threshold);
    const priorityLevel = this.scorer.getPriorityLevel(priorityResult.score);

    // Auto-flag if enabled and score exceeds threshold
    if (shouldFlag && this.config.autoFlag) {
      await this.flagMention(mention.id, priorityResult.score, priorityLevel, priorityResult.reasons);
    }

    return {
      flagged: shouldFlag,
      priorityScore: priorityResult.score,
      priorityLevel,
      reasons: priorityResult.reasons,
    };
  }

  /**
   * Flag a mention in the database
   */
  async flagMention(
    mentionId: string,
    priorityScore: number,
    priorityLevel: 'low' | 'medium' | 'high' | 'critical',
    reasons: string[]
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('mentions')
        .update({
          is_flagged: true,
          priority_score: priorityScore,
        })
        .eq('id', mentionId);

      if (error) {
        console.error('Error flagging mention:', error);
        throw error;
      }

      console.log(`Mention ${mentionId} flagged with priority ${priorityLevel} (score: ${priorityScore})`);
    } catch (error) {
      console.error('Error in flagMention:', error);
      throw error;
    }
  }

  /**
   * Unflag a mention
   */
  async unflagMention(mentionId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('mentions')
        .update({
          is_flagged: false,
        })
        .eq('id', mentionId);

      if (error) {
        console.error('Error unflagging mention:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in unflagMention:', error);
      throw error;
    }
  }

  /**
   * Get all flagged mentions for a user
   */
  async getFlaggedMentions(userId: string, limit: number = 50): Promise<FlaggedMention[]> {
    try {
      const { data: mentions, error } = await supabaseAdmin
        .from('mentions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_flagged', true)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching flagged mentions:', error);
        throw error;
      }

      // Enrich with priority level and reasons
      return (mentions || []).map(mention => {
        const priorityLevel = this.scorer.getPriorityLevel(mention.priority_score || 0);
        const priorityResult = this.scorer.calculateScore({
          text: mention.text,
          sentiment: mention.sentiment,
          sentiment_confidence: mention.sentiment_confidence,
        });

        return {
          ...mention,
          priority_level: priorityLevel,
          flag_reasons: priorityResult.reasons,
        } as FlaggedMention;
      });
    } catch (error) {
      console.error('Error in getFlaggedMentions:', error);
      throw error;
    }
  }

  /**
   * Record human response for learning (future improvement)
   */
  async recordHumanResponse(
    mentionId: string,
    action: 'responded' | 'ignored' | 'escalated',
    notes?: string
  ): Promise<void> {
    // This can be extended to track human responses and improve flagging accuracy
    // For now, just log the action
    console.log(`Human response recorded for mention ${mentionId}: ${action}`, notes);
  }
}

/**
 * Factory function to create a flagging service
 */
export function createFlaggingService(config?: Partial<FlaggingConfig>): FlaggingService {
  return new FlaggingService(config);
}

