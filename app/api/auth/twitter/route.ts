import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { getCurrentUser } from '@/lib/auth-utils'
import { getXApiConsumerKeysForOAuth } from '@/lib/x-api-storage'
import {
  getXOAuthCallbackUrl,
  sanitizeXOAuthReturnTo,
  X_OAUTH_COOKIE_NAMES,
  xOAuthCookieOptions,
} from '@/lib/x-oauth-config'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const consumer = await getXApiConsumerKeysForOAuth(user.id)
    if (!consumer.success || !consumer.apiKey || !consumer.apiKeySecret) {
      return NextResponse.json(
        { error: consumer.error || 'Save your X API Key and API Key Secret in Settings first.' },
        { status: 400 }
      )
    }

    const client = new TwitterApi({
      appKey: consumer.apiKey,
      appSecret: consumer.apiKeySecret,
    })

    const callbackUrl = getXOAuthCallbackUrl(request)
    // twitter-api-v2 defaults to /oauth/authenticate ("Sign in with Twitter"); X often
    // rejects that for posting/API apps — /oauth/authorize is the standard 3-legged flow.
    const { url, oauth_token, oauth_token_secret } = await client.generateAuthLink(callbackUrl, {
      linkMode: 'authorize',
    })

    const returnTo = sanitizeXOAuthReturnTo(request.nextUrl.searchParams.get('returnTo'))

    const response = NextResponse.redirect(url)
    const cookieOpts = xOAuthCookieOptions(60 * 15)

    response.cookies.set(X_OAUTH_COOKIE_NAMES.tokenSecret, oauth_token_secret, cookieOpts)
    response.cookies.set(X_OAUTH_COOKIE_NAMES.token, oauth_token, cookieOpts)
    response.cookies.set(X_OAUTH_COOKIE_NAMES.returnTo, returnTo, cookieOpts)

    return response
  } catch (error: unknown) {
    console.error('Twitter OAuth error:', error)
    return NextResponse.redirect(new URL('/auth/error?error=twitter_oauth_failed', request.url))
  }
}
