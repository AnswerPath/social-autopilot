import { NextRequest, NextResponse } from 'next/server'
import { postTweet, scheduleTweet } from '@/lib/twitter-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, mediaIds, scheduledTime } = body

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tweet text is required' },
        { status: 400 }
      )
    }

    if (text.length > 280) {
      return NextResponse.json(
        { error: 'Tweet text exceeds 280 characters' },
        { status: 400 }
      )
    }

    let result
    if (scheduledTime) {
      // Schedule the tweet
      result = await scheduleTweet(text, new Date(scheduledTime), mediaIds)
    } else {
      // Post immediately
      result = await postTweet(text, mediaIds)
    }

    if (result.success) {
      return NextResponse.json(result.data || { jobId: result.jobId })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
