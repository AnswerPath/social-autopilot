import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await _request.json()
    const update: any = {}
    if (typeof body.content === 'string') update.content = body.content.trim()
    if (Array.isArray(body.mediaUrls)) update.media_urls = body.mediaUrls
    if (body.scheduledAt) update.scheduled_at = new Date(body.scheduledAt).toISOString()
    if (body.status) update.status = body.status
    if (body.postedTweetId) update.posted_tweet_id = body.postedTweetId
    if (body.error) update.error = body.error

    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, post: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to update scheduled post' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { error } = await supabaseAdmin
      .from('scheduled_posts')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete scheduled post' }, { status: 500 })
  }
}


