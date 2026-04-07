import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { applyScheduledPostPatchBody } from '@/lib/apply-scheduled-post-patch-body'

export const runtime = 'nodejs'

function getUserId(): string {
  return 'demo-user'
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    return applyScheduledPostPatchBody(id, getUserId(), body)
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update scheduled post',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('scheduled_posts').delete().eq('id', id)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Failed to delete scheduled post' }, { status: 500 })
  }
}
