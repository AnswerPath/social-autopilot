import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SchedulingService } from '@/lib/scheduling-service'

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
      .select('*')
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
      console.error('Error fetching scheduled posts:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error.details || error.hint 
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, posts: data || [] })
  } catch (error: any) {
    console.error('Exception in GET scheduled-posts:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to list scheduled posts',
      details: error.message 
    }, { status: 500 })
  }
}

// Enhanced POST to check approval requirements with timezone support and conflict detection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received schedule request:', JSON.stringify(body, null, 2))
    
    const { 
      content, 
      mediaUrls, 
      scheduledAt, 
      scheduledDate, 
      scheduledTime, 
      timezone,
      status, 
      submitForApproval 
    } = body
    
    const userId = getUserId()
    const schedulingService = new SchedulingService()

    // Support both legacy format (scheduledAt) and new format (scheduledDate + scheduledTime)
    let result
    if (scheduledDate && scheduledTime) {
      console.log('Using new format with date/time:', { scheduledDate, scheduledTime, timezone })
      // New format with timezone support
      result = await schedulingService.schedulePost({
        content,
        mediaUrls,
        scheduledDate,
        scheduledTime,
        timezone,
        userId,
        status: status || (submitForApproval ? 'pending_approval' : undefined),
        requiresApproval: submitForApproval
      })
    } else if (scheduledAt) {
      // Legacy format - parse scheduledAt and extract date/time
      const scheduledDateObj = new Date(scheduledAt)
      const year = scheduledDateObj.getFullYear()
      const month = String(scheduledDateObj.getMonth() + 1).padStart(2, '0')
      const day = String(scheduledDateObj.getDate()).padStart(2, '0')
      const hours = String(scheduledDateObj.getHours()).padStart(2, '0')
      const minutes = String(scheduledDateObj.getMinutes()).padStart(2, '0')
      
      result = await schedulingService.schedulePost({
        content,
        mediaUrls,
        scheduledDate: `${year}-${month}-${day}`,
        scheduledTime: `${hours}:${minutes}`,
        timezone,
        userId,
        status: status || (submitForApproval ? 'pending_approval' : undefined),
        requiresApproval: submitForApproval
      })
    } else {
      console.error('Missing required fields:', { scheduledAt, scheduledDate, scheduledTime })
      return NextResponse.json({ 
        success: false,
        error: 'Either scheduledAt or both scheduledDate and scheduledTime are required' 
      }, { status: 400 })
    }

    console.log('Schedule result:', JSON.stringify({ success: result.success, error: result.error }, null, 2))

    if (!result.success) {
      // Check if it's a conflict error
      if (result.conflictCheck && result.conflictCheck.hasConflict) {
        return NextResponse.json({ 
          success: false, 
          error: result.error,
          conflictCheck: result.conflictCheck
        }, { status: 409 }) // 409 Conflict
      }
      
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      post: result.post,
      requiresApproval: result.post?.requires_approval || false,
      message: result.post?.requires_approval ? 'Post submitted for approval' : 'Post created successfully'
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create scheduled post',
      details: error.message 
    }, { status: 500 })
  }
}
