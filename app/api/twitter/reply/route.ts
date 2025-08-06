import { NextRequest, NextResponse } from 'next/server'
import { replyToTweet } from '@/lib/twitter-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tweetId, replyText } = body

    if (!tweetId || !replyText) {
      return NextResponse.json(
        { error: 'Tweet ID and reply text are required' },
        { status: 400 }
      )
    }

    const result = await replyToTweet(tweetId, replyText)

    if (result.success) {
      return NextResponse.json(result.data)
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
