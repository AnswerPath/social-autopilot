import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { applyScheduledPostPatchBody } from '@/lib/apply-scheduled-post-patch-body'
import { getCurrentUser } from '@/lib/auth-utils'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    return applyScheduledPostPatchBody(id, user.id, body)
  } catch (error: unknown) {
    console.error('[PATCH /api/scheduled-posts/:id]', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update scheduled post' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('scheduled_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    if (!data?.length) {
      return NextResponse.json({ success: false, error: 'Scheduled post not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete scheduled post' }, { status: 500 })
  }
}
