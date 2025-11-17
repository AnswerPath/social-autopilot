import { supabaseAdmin } from '@/lib/supabase'

export type ApprovalCommentType = 'feedback' | 'approval' | 'rejection' | 'revision_request'

export interface ApprovalComment {
  id: string
  post_id: string
  user_id: string
  comment: string
  comment_type: ApprovalCommentType
  is_resolved: boolean
  resolved_at?: string | null
  resolved_by?: string | null
  parent_comment_id?: string | null
  thread_id?: string | null
  mentions?: string[] | null
  workflow_step_id?: string | null
  created_at: string
  updated_at: string
}

export async function getApprovalComments(postId: string): Promise<ApprovalComment[]> {
  const { data, error } = await supabaseAdmin
    .from('approval_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch approval comments', error)
    throw new Error(error.message)
  }

  return (data as ApprovalComment[]) || []
}

interface CreateCommentInput {
  postId: string
  userId: string
  comment: string
  commentType?: ApprovalCommentType
  parentCommentId?: string
  mentions?: string[]
  workflowStepId?: string
}

export async function createApprovalComment({
  postId,
  userId,
  comment,
  commentType = 'feedback',
  parentCommentId,
  mentions,
  workflowStepId
}: CreateCommentInput): Promise<ApprovalComment> {
  const payload = {
    post_id: postId,
    user_id: userId,
    comment,
    comment_type: commentType,
    parent_comment_id: parentCommentId ?? null,
    thread_id: parentCommentId ?? undefined,
    mentions: mentions?.length ? mentions : null,
    workflow_step_id: workflowStepId ?? null
  }

  const { data, error } = await supabaseAdmin
    .from('approval_comments')
    .insert({
      ...payload,
      thread_id: parentCommentId,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create approval comment', error)
    throw new Error(error.message)
  }

  // Ensure thread_id is set to self for root comments
  if (!data.thread_id) {
    await supabaseAdmin
      .from('approval_comments')
      .update({ thread_id: data.id })
      .eq('id', data.id)
  }

  return data as ApprovalComment
}

export async function resolveApprovalComment(
  commentId: string,
  resolverId: string,
  resolvedComment?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('approval_comments')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolverId,
      resolved_comment: resolvedComment ?? null
    })
    .eq('id', commentId)

  if (error) {
    console.error('Failed to resolve approval comment', error)
    throw new Error(error.message)
  }
}

