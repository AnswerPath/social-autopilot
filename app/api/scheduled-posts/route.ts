import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
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
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true })

    if (from && to) {
      query = query.gte('scheduled_at', from).lte('scheduled_at', to)
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, mediaUrls, scheduledAt, status } = body
    if (!content || !scheduledAt) {
      return NextResponse.json({ error: 'content and scheduledAt are required' }, { status: 400 })
    }
    const userId = getUserId()

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .insert({
        user_id: userId,
        content: content.trim(),
        media_urls: Array.isArray(mediaUrls) ? mediaUrls : null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: status || 'scheduled',
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, post: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to create scheduled post' }, { status: 500 })
  }
}


