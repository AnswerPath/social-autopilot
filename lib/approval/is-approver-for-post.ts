import { supabaseAdmin } from '@/lib/supabase'

const ACTIVE_ASSIGNMENT_STATUSES: readonly string[] = ['pending', 'in_review']

/**
 * True when the user is assigned as approver for the post's current workflow step
 * (matches how the approval dashboard resolves rows for a user).
 */
export async function isApproverForPost(userId: string, postId: string): Promise<boolean> {
  const { data: assignment, error } = await supabaseAdmin
    .from('post_approval_assignments')
    .select('current_step_id, status')
    .eq('post_id', postId)
    .maybeSingle()

  if (error || !assignment?.current_step_id) return false

  const st = String(assignment.status ?? '')
  if (!ACTIVE_ASSIGNMENT_STATUSES.includes(st)) {
    return false
  }

  const { data: steps, error: stepErr } = await supabaseAdmin
    .from('approval_workflow_steps')
    .select('id')
    .eq('approver_reference', userId)

  if (stepErr || !steps?.length) return false

  return steps.some((row: { id: string }) => row.id === assignment.current_step_id)
}
