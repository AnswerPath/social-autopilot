import { supabaseAdmin } from '@/lib/supabase'

export interface ApprovalRule {
  id: string
  rule_name: string
  rule_type: 'content_approval' | 'time_approval' | 'media_approval' | 'keyword_approval'
  conditions: Record<string, any>
  requires_approval: boolean
  approver_user_ids: string[]
  auto_approve_after_hours?: number
}

export interface ApprovalDecision {
  requiresApproval: boolean
  reason?: string
  rule?: ApprovalRule
}

/**
 * Check if a post requires approval based on configured rules
 */
export async function checkApprovalRequired(
  userId: string,
  content: string,
  mediaUrls?: string[],
  scheduledAt?: Date
): Promise<ApprovalDecision> {
  try {
    // Get active approval rules for the user
    const { data: rules, error } = await supabaseAdmin
      .from('approval_workflow_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching approval rules:', error)
      return { requiresApproval: false }
    }

    if (!rules || rules.length === 0) {
      return { requiresApproval: false }
    }

    // Evaluate each rule
    for (const rule of rules) {
      const decision = evaluateRule(rule, content, mediaUrls, scheduledAt)
      if (decision.requiresApproval) {
        return { ...decision, rule }
      }
    }

    return { requiresApproval: false }
  } catch (error) {
    console.error('Error checking approval requirements:', error)
    return { requiresApproval: false }
  }
}

/**
 * Evaluate a single approval rule
 */
function evaluateRule(
  rule: ApprovalRule,
  content: string,
  mediaUrls?: string[],
  scheduledAt?: Date
): ApprovalDecision {
  switch (rule.rule_type) {
    case 'content_approval':
      return evaluateContentRule(rule, content)
    case 'media_approval':
      return evaluateMediaRule(rule, mediaUrls)
    case 'time_approval':
      return evaluateTimeRule(rule, scheduledAt)
    case 'keyword_approval':
      return evaluateKeywordRule(rule, content)
    default:
      return { requiresApproval: false }
  }
}

function evaluateContentRule(rule: ApprovalRule, content: string): ApprovalDecision {
  const conditions = rule.conditions
  
  // Check content length
  if (conditions.max_length && content.length > conditions.max_length) {
    return {
      requiresApproval: true,
      reason: `Content exceeds maximum length of ${conditions.max_length} characters`
    }
  }

  // Check for sensitive keywords
  if (conditions.keywords && Array.isArray(conditions.keywords)) {
    const lowerContent = content.toLowerCase()
    for (const keyword of conditions.keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return {
          requiresApproval: true,
          reason: `Content contains sensitive keyword: "${keyword}"`
        }
      }
    }
  }

  return { requiresApproval: false }
}

function evaluateMediaRule(rule: ApprovalRule, mediaUrls?: string[]): ApprovalDecision {
  const conditions = rule.conditions
  
  if (conditions.require_approval_with_media && mediaUrls && mediaUrls.length > 0) {
    return {
      requiresApproval: true,
      reason: 'Media content requires approval'
    }
  }

  return { requiresApproval: false }
}

function evaluateTimeRule(rule: ApprovalRule, scheduledAt?: Date): ApprovalDecision {
  const conditions = rule.conditions
  
  if (conditions.business_hours_only && scheduledAt) {
    const hour = scheduledAt.getHours()
    if (hour < 9 || hour > 17) {
      return {
        requiresApproval: true,
        reason: 'Post scheduled outside business hours (9 AM - 5 PM)'
      }
    }
  }

  return { requiresApproval: false }
}

function evaluateKeywordRule(rule: ApprovalRule, content: string): ApprovalDecision {
  const conditions = rule.conditions
  
  if (conditions.forbidden_keywords && Array.isArray(conditions.forbidden_keywords)) {
    const lowerContent = content.toLowerCase()
    for (const keyword of conditions.forbidden_keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return {
          requiresApproval: true,
          reason: `Content contains forbidden keyword: "${keyword}"`
        }
      }
    }
  }

  return { requiresApproval: false }
}

/**
 * Get approval statistics for a user
 */
export async function getApprovalStats(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('approval_statistics')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching approval stats:', error)
    return null
  }
}

/**
 * Get posts pending approval for a user
 */
export async function getPendingApprovals(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select(`
        *,
        approval_comments (
          id,
          comment,
          comment_type,
          user_id,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending_approval')
      .order('submitted_for_approval_at', { ascending: true })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return []
  }
}
