import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    const oauth_token_secret = request.cookies.get('oauth_token_secret')?.value

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
      return NextResponse.redirect('/auth/error?error=missing_oauth_params')
    }

    // Initialize client with temporary credentials
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: oauth_token,
      accessSecret: oauth_token_secret,
    })

    // Get access tokens
    const { accessToken, accessSecret, screenName, userId } = await client.login(oauth_verifier)

    // Store tokens securely (in production, use encrypted database storage)
    // For demo purposes, we'll set them as environment variables
    // In a real app, you'd store these per-user in your database
    
    const response = NextResponse.redirect('/')
    response.cookies.set('twitter_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
    response.cookies.set('twitter_access_secret', accessSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return response
  } catch (error: any) {
    console.error('Twitter OAuth callback error:', error)
    return NextResponse.redirect('/auth/error?error=twitter_callback_failed')
  }
}
