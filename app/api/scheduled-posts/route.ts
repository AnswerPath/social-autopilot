import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

// Enhanced GET to include approval workflow data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
    const status = searchParams.get('status') // Filter by approval status
    const userId = getUserId()

    let from: string | null = null
    let to: string | null = null
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59))
      from = start.toISOString()
      to = end.toISOString()
    }

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
        )
      `)
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true })

    if (from && to) {
      query = query.gte('scheduled_at', from).lte('scheduled_at', to)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, posts: data || [] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to list scheduled posts' }, { status: 500 })
  }
}

// Enhanced POST to check approval requirements
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, mediaUrls, scheduledAt, status, submitForApproval } = body
    if (!content || !scheduledAt) {
      return NextResponse.json({ error: 'content and scheduledAt are required' }, { status: 400 })
    }
    const userId = getUserId()

    // Determine initial status based on approval requirements
    let initialStatus = status || 'draft'
    let requiresApproval = false

    // Check if approval is required (basic logic - can be enhanced)
    if (submitForApproval) {
      initialStatus = 'pending_approval'
      requiresApproval = true
    } else if (content.length > 200 || 
               content.toLowerCase().includes('sale') || 
               content.toLowerCase().includes('discount') ||
               (mediaUrls && mediaUrls.length > 0)) {
      initialStatus = 'pending_approval'
      requiresApproval = true
    }

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        content: content.trim(),
        media_urls: Array.isArray(mediaUrls) ? mediaUrls : null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: initialStatus,
        requires_approval: requiresApproval,
        submitted_for_approval_at: initialStatus === 'pending_approval' ? new Date().toISOString() : null
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      post: data,
      requiresApproval,
      message: requiresApproval ? 'Post submitted for approval' : 'Post created successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to create scheduled post' }, { status: 500 })
  }
}
