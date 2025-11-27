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
  // For root comments, thread_id will be set to the comment's own id after creation
  // For replies, thread_id should match the parent's thread_id (handled after insert)
  const payload = {
    post_id: postId,
    user_id: userId,
    comment,
    comment_type: commentType,
    parent_comment_id: parentCommentId ?? null,
    thread_id: null, // Will be set correctly after insert
    mentions: mentions?.length ? mentions : null,
    workflow_step_id: workflowStepId ?? null
  }

  const { data, error } = await supabaseAdmin
    .from('approval_comments')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create approval comment', error)
    throw new Error(error.message)
  }

  // Set thread_id: for root comments, use own id; for replies, get parent's thread_id
  let threadId: string
  if (parentCommentId) {
    // Get parent comment's thread_id
    const { data: parentComment } = await supabaseAdmin
      .from('approval_comments')
      .select('thread_id')
      .eq('id', parentCommentId)
      .single()
    threadId = parentComment?.thread_id || parentCommentId
  } else {
    // Root comment: thread_id is the comment's own id
    threadId = data.id
  }

  // Update with correct thread_id
  const { data: updatedData, error: updateError } = await supabaseAdmin
    .from('approval_comments')
    .update({ thread_id: threadId })
    .eq('id', data.id)
    .select('*')
    .single()

  if (updateError) {
    console.error('Failed to update thread_id', updateError)
    // Return original data even if thread_id update fails
    return data as ApprovalComment
  }

  return updatedData as ApprovalComment
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

