import { supabaseAdmin } from '@/lib/supabase'

export interface PostRevision {
  id: string
  post_id: string
  revision_number: number
  author_id: string
  snapshot: Record<string, any>
  diff?: Record<string, any>
  created_at: string
  created_reason?: string | null
  // Not persisted in the DB; derived on read for richer UI labelling.
  summary?: string
}

export async function recordRevision(
  postId: string,
  authorId: string,
  snapshot: Record<string, any>,
  diff?: Record<string, any>,
  reason?: string
): Promise<PostRevision> {
  const revisionNumber = await nextRevisionNumber(postId)

  const { data, error } = await supabaseAdmin
    .from('post_revisions')
    .insert({
      post_id: postId,
      revision_number: revisionNumber,
      author_id: authorId,
      snapshot,
      diff: diff ?? null,
      created_reason: reason ?? null
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to record revision', error)
    throw new Error(error.message)
  }

  return data as PostRevision
}

async function nextRevisionNumber(postId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('post_revisions')
    .select('revision_number')
    .eq('post_id', postId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to get revision number', error)
    throw new Error(error.message)
  }

  if (!data) {
    return 1
  }

  return (data.revision_number || 0) + 1
}

export async function listRevisions(postId: string): Promise<PostRevision[]> {
  const { data, error } = await supabaseAdmin
    .from('post_revisions')
    .select('*')
    .eq('post_id', postId)
    .order('revision_number', { ascending: false })

  if (error) {
    console.error('Failed to list revisions', error)
    throw new Error(error.message)
  }

  const revisions = (data as PostRevision[]) || []
  return revisions.map((revision) => ({
    ...revision,
    summary: buildRevisionSummary(revision)
  }))
}

export async function restoreRevision(postId: string, revisionId: string): Promise<PostRevision | null> {
  const { data, error } = await supabaseAdmin
    .from('post_revisions')
    .select('*')
    .eq('post_id', postId)
    .eq('id', revisionId)
    .single()

  if (error) {
    console.error('Failed to load revision', error)
    throw new Error(error.message)
  }

  return data as PostRevision
}

function buildRevisionSummary(revision: PostRevision): string {
  const snapshot = revision.snapshot || {}
  const rawContent = typeof snapshot.content === 'string' ? snapshot.content : ''
  const normalized = rawContent.replace(/\s+/g, ' ').trim()

  if (normalized) {
    const truncated = normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized
    return truncated
  }

  if (revision.created_reason) {
    return revision.created_reason
  }

  return `Revision #${revision.revision_number}`
}

