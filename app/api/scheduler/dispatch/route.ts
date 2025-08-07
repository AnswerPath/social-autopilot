import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { postTweet } from '@/lib/twitter-api-node'

export const runtime = 'nodejs'

export async function POST(_request: NextRequest) {
  try {
    const nowIso = new Date().toISOString()
    const { data: due, error } = await supabaseAdmin
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    const results: any[] = []
    for (const job of due || []) {
      try {
        const res = await postTweet(job.content, undefined, job.user_id)
        if (res.success) {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ status: 'published', posted_tweet_id: res.data?.id || null })
            .eq('id', job.id)
          results.push({ id: job.id, status: 'published', tweetId: res.data?.id })
        } else {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ status: 'failed', error: res.error || 'Unknown error' })
            .eq('id', job.id)
          results.push({ id: job.id, status: 'failed', error: res.error })
        }
      } catch (e: any) {
        await supabaseAdmin
          .from('scheduled_posts')
          .update({ status: 'failed', error: e.message })
          .eq('id', job.id)
        results.push({ id: job.id, status: 'failed', error: e.message })
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Dispatch failed' }, { status: 500 })
  }
}


