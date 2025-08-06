import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'

export async function GET(request: NextRequest) {
  try {
    // Initialize Twitter client for OAuth
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
    })

    // Generate OAuth URL
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/twitter/callback`
    )

    // Store oauth_token_secret in session/database for callback
    // For now, we'll use a simple approach (in production, use proper session management)
    const response = NextResponse.redirect(url)
    response.cookies.set('oauth_token_secret', oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 15 // 15 minutes
    })

    return response
  } catch (error: any) {
    console.error('Twitter OAuth error:', error)
    return NextResponse.redirect('/auth/error?error=twitter_oauth_failed')
  }
}
