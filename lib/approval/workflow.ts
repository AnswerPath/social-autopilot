import { supabaseAdmin } from '@/lib/supabase'
import { queueApprovalNotifications } from '@/lib/approval/notifications'

export interface ApprovalWorkflow {
  id: string
  owner_id: string
  name: string
  description?: string | null
  scope: 'global' | 'team' | 'department' | 'content_type'
  scope_filters?: Record<string, any> | null
  is_active: boolean
  created_by: string
}

export interface ApprovalWorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_name: string
  approver_type: 'user' | 'role' | 'team'
  approver_reference: string
  min_approvals: number
  auto_escalate_after_hours?: number | null
  is_optional: boolean
  sla_hours?: number | null
}

export interface PostApprovalAssignment {
  id: string
  post_id: string
  workflow_id: string
  current_step_id: string | null
  status: 'draft' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested'
  step_history?: Array<Record<string, any>>
  created_at: string
  updated_at: string
}

export type ApprovalWorkflowDecision = 'approve' | 'reject' | 'request_changes'

interface WorkflowWithSteps extends ApprovalWorkflow {
  steps: ApprovalWorkflowStep[]
}

export interface ApprovalDashboardRow {
  post_id: string
  user_id: string
  status: string
  scheduled_at: string | null
  submitted_for_approval_at: string | null
  requires_approval: boolean
  workflow_id: string | null
  current_step_id: string | null
  assignment_status: string | null
  step_name?: string | null
  step_order?: number | null
  open_comments: number
  total_comments: number
}

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
export async function getPendingApprovals(userId: string, postId?: string) {
  try {
    let query = supabaseAdmin
      .from('scheduled_posts')
      .select(`
        *,
        approval_comments (
          id,
          comment,
          comment_type,
          user_id,
          created_at,
          is_resolved
        ),
        post_approval_assignments (
          status,
          current_step_id,
          workflow_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending_approval')
      .order('submitted_for_approval_at', { ascending: true })

    if (postId) {
      query = query.eq('id', postId)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return []
  }
}

/**
 * Ensure a post is attached to a workflow assignment and kick off notifications for the first step.
 */
export async function ensureWorkflowAssignment(
  postId: string,
  ownerId: string,
  workflowId?: string
): Promise<PostApprovalAssignment> {
  const existing = await supabaseAdmin
    .from('post_approval_assignments')
    .select('*')
    .eq('post_id', postId)
    .maybeSingle()

  if (existing.data) {
    return existing.data as PostApprovalAssignment
  }

  const workflow = await loadWorkflow(ownerId, workflowId)
  if (!workflow || !workflow.steps.length) {
    throw new Error('No active approval workflow configured')
  }

  const firstStep = workflow.steps.sort((a, b) => a.step_order - b.step_order)[0]
  const stepHistoryEntry = [{
    stepId: firstStep.id,
    status: 'pending',
    startedAt: new Date().toISOString()
  }]

  const { data, error } = await supabaseAdmin
    .from('post_approval_assignments')
    .insert({
      post_id: postId,
      workflow_id: workflow.id,
      current_step_id: firstStep.id,
      status: 'pending',
      step_history: stepHistoryEntry
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create post approval assignment', error)
    throw new Error(error.message)
  }

  const { error: updateError } = await supabaseAdmin
    .from('scheduled_posts')
    .update({
      approval_workflow_id: workflow.id,
      current_step_order: firstStep.step_order,
      approval_dashboard_metadata: {
        currentStep: firstStep.step_name,
        pendingSince: new Date().toISOString()
      }
    })
    .eq('id', postId)

  if (updateError) {
    console.error('Failed to update scheduled post with workflow metadata', updateError)
    throw new Error(updateError.message)
  }

  await queueApprovalNotifications({
    postId,
    recipientIds: resolveApprovers(firstStep),
    notificationType: 'approval_step_ready',
    payload: {
      stepName: firstStep.step_name,
      workflowId: workflow.id
    },
    channels: ['in_app', 'email']
  })

  return data as PostApprovalAssignment
}

/**
 * Advance workflow state for a post.
 */
export async function advanceWorkflowStep(
  postId: string,
  actorId: string,
  decision: ApprovalWorkflowDecision,
  options?: { comment?: string; reason?: string }
) {
  const assignment = await getAssignment(postId)
  if (!assignment) {
    throw new Error('Post is not attached to an approval workflow')
  }

  const workflow = await loadWorkflow('', assignment.workflow_id)
  if (!workflow) {
    throw new Error('Missing workflow configuration')
  }

  const steps = workflow.steps.sort((a, b) => a.step_order - b.step_order)
  const currentStep = steps.find((step) => step.id === assignment.current_step_id)
  const nextStep = currentStep
    ? steps.find((step) => step.step_order > currentStep.step_order)
    : undefined

  const history = Array.isArray(assignment.step_history) ? assignment.step_history : []
  history.push({
    actorId,
    decision,
    stepId: currentStep?.id ?? null,
    timestamp: new Date().toISOString(),
    comment: options?.comment
  })

  let newAssignmentStatus: PostApprovalAssignment['status'] = assignment.status
  let newPostStatus = 'pending_approval'
  let nextStepId: string | null = assignment.current_step_id
  let currentStepOrder: number | null | undefined = currentStep?.step_order ?? null

  if (decision === 'approve') {
    if (nextStep) {
      newAssignmentStatus = 'in_review'
      nextStepId = nextStep.id
      currentStepOrder = nextStep.step_order
      await queueApprovalNotifications({
        postId,
        recipientIds: resolveApprovers(nextStep),
        notificationType: 'approval_step_ready',
        payload: { stepName: nextStep.step_name, workflowId: workflow.id },
        channels: ['in_app', 'email']
      })
    } else {
      newAssignmentStatus = 'approved'
      newPostStatus = 'approved'
      nextStepId = null
      currentStepOrder = steps.length
    }
  } else if (decision === 'reject') {
    newAssignmentStatus = 'rejected'
    newPostStatus = 'rejected'
    nextStepId = null
  } else if (decision === 'request_changes') {
    newAssignmentStatus = 'changes_requested'
    newPostStatus = 'draft'
  }

  const { error: updateAssignmentError } = await supabaseAdmin
    .from('post_approval_assignments')
    .update({
      status: newAssignmentStatus,
      current_step_id: nextStepId,
      step_history: history
    })
    .eq('post_id', postId)

  if (updateAssignmentError) {
    console.error('Failed to update post approval assignment', updateAssignmentError)
    throw new Error(updateAssignmentError.message)
  }

  const { error: updatePostError } = await supabaseAdmin
    .from('scheduled_posts')
    .update({
      status: newPostStatus,
      current_step_order: currentStepOrder,
      approval_dashboard_metadata: {
        decision,
        actorId,
        updatedAt: new Date().toISOString(),
        comment: options?.comment,
        reason: options?.reason
      }
    })
    .eq('id', postId)

  if (updatePostError) {
    console.error('Failed to update scheduled post status', updatePostError)
    throw new Error(updatePostError.message)
  }

  // Preserve both comment and reason in action_details, even if only one is provided
  const hasDetails = options?.comment || options?.reason
  const actionDetails = hasDetails
    ? { comment: options?.comment ?? null, reason: options?.reason ?? null }
    : null

  const { error: historyError } = await supabaseAdmin
    .from('approval_history')
    .insert({
      post_id: postId,
      action: mapDecisionToHistoryAction(decision),
      user_id: actorId,
      previous_status: assignment.status,
      new_status: newPostStatus,
      workflow_step_id: currentStep?.id ?? null,
      action_details: actionDetails
    })

  if (historyError) {
    console.error('Failed to insert approval history', historyError)
    throw new Error(historyError.message)
  }
}

export async function bulkAdvanceWorkflow(
  postIds: string[],
  actorId: string,
  decision: ApprovalWorkflowDecision
): Promise<{ success: string[]; failed: Array<{ postId: string; error: string }> }> {
  const success: string[] = []
  const failed: Array<{ postId: string; error: string }> = []

  for (const postId of postIds) {
    try {
      await advanceWorkflowStep(postId, actorId, decision)
      success.push(postId)
    } catch (error) {
      failed.push({
        postId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return { success, failed }
}

export async function getApprovalDashboard(userId: string): Promise<ApprovalDashboardRow[]> {
  const approverSteps = await supabaseAdmin
    .from('approval_workflow_steps')
    .select('id')
    .eq('approver_reference', userId)

  if (approverSteps.error) {
    console.error('Failed to fetch approver step mapping', approverSteps.error)
    throw new Error(approverSteps.error.message)
  }

  const stepIds = approverSteps.data?.map((row) => row.id) ?? []

  let query = supabaseAdmin
    .from('approval_dashboard_summary')
    .select('*')
    .order('submitted_for_approval_at', { ascending: true })

  if (stepIds.length > 0) {
    query = query.in('current_step_id', stepIds)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch approval dashboard rows', error)
    throw new Error(error.message)
  }

  const rows = ((data as ApprovalDashboardRow[]) || []).map((row) => {
    // Provide sensible defaults for items that require approval but don't yet
    // have a multi-step workflow assignment.
    const hasWorkflow = !!row.workflow_id && !!row.current_step_id
    return {
      ...row,
      step_name: hasWorkflow ? row.step_name : row.step_name ?? (row.requires_approval ? 'Single-step review' : null),
      step_order: hasWorkflow ? row.step_order : row.step_order ?? (row.requires_approval ? 1 : null),
      assignment_status: row.assignment_status ?? (row.requires_approval ? 'pending' : row.status)
    }
  })

  return rows
}

async function getAssignment(postId: string): Promise<PostApprovalAssignment | null> {
  const { data, error } = await supabaseAdmin
    .from('post_approval_assignments')
    .select('*')
    .eq('post_id', postId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Failed to fetch post assignment', error)
    throw new Error(error.message)
  }

  return data as PostApprovalAssignment
}

async function loadWorkflow(ownerId: string, workflowId?: string | null): Promise<WorkflowWithSteps | null> {
  if (!workflowId && !ownerId) return null

  let query = supabaseAdmin
    .from('approval_workflows')
    .select(
      `
      *,
      approval_workflow_steps (*)
    `
    )
    .eq('is_active', true)

  if (workflowId) {
    query = query.eq('id', workflowId)
  } else {
    query = query.eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No active workflow – create a default single-step workflow for this owner
      if (ownerId && !workflowId) {
        const created = await createDefaultWorkflow(ownerId)
        return created
      }
      return null
    }
    console.error('Failed to load approval workflow', error)
    throw new Error(error.message)
  }

  const steps = (data.approval_workflow_steps || []) as ApprovalWorkflowStep[]
  return { ...(data as ApprovalWorkflow), steps }
}

function resolveApprovers(step: ApprovalWorkflowStep): string[] {
  if (step.approver_type === 'user') {
    return [step.approver_reference]
  }

  // For demo purposes fall back to default manager accounts
  if (step.approver_type === 'role') {
    return step.approver_reference === 'manager' ? ['manager-user'] : ['admin-user']
  }

  return [step.approver_reference]
}

function mapDecisionToHistoryAction(decision: ApprovalWorkflowDecision): string {
  switch (decision) {
    case 'approve':
      return 'approved'
    case 'reject':
      return 'rejected'
    case 'request_changes':
      return 'revision_requested'
    default:
      return 'status_changed'
  }
}

/**
 * Create a default, single-step workflow for an owner if none exists.
 * The first step assigns to "manager-user" to match demo data.
 */
async function createDefaultWorkflow(ownerId: string): Promise<WorkflowWithSteps> {
  const { data: wf, error: wfErr } = await supabaseAdmin
    .from('approval_workflows')
    .insert({
      owner_id: ownerId,
      name: 'Default Approval Workflow',
      description: 'Auto-created default workflow',
      scope: 'global',
      is_active: true,
      created_by: ownerId
    })
    .select('*')
    .single()

  if (wfErr) {
    console.error('Failed to create default workflow', wfErr)
    throw new Error(wfErr.message)
  }

  const workflow = wf as ApprovalWorkflow
  const { data: step, error: stepErr } = await supabaseAdmin
    .from('approval_workflow_steps')
    .insert({
      workflow_id: workflow.id,
      step_order: 1,
      step_name: 'Review',
      approver_type: 'user',
      approver_reference: 'manager-user',
      min_approvals: 1
    })
    .select('*')
    .single()

  if (stepErr) {
    console.error('Failed to create default workflow step', stepErr)
    throw new Error(stepErr.message)
  }

  return {
    ...(wf as ApprovalWorkflow),
    steps: [step as unknown as ApprovalWorkflowStep]
  }
}
