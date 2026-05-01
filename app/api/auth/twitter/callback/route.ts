import { NextRequest, NextResponse } from 'next/server'
import { TwitterApi } from 'twitter-api-v2'
import { getCurrentUser } from '@/lib/auth-utils'
import { completeXApiOAuth, getXApiConsumerKeysForOAuth } from '@/lib/x-api-storage'
import {
  appendXOAuthError,
  resolveXOAuthAppOrigin,
  sanitizeXOAuthReturnTo,
  X_OAUTH_COOKIE_NAMES,
  xOAuthCookieOptions,
} from '@/lib/x-oauth-config'

function absoluteRedirect(request: NextRequest, pathnameWithQuery: string) {
  const base = resolveXOAuthAppOrigin(request)
  return NextResponse.redirect(new URL(pathnameWithQuery, `${base}/`).toString())
}

function clearOAuthCookies(response: NextResponse) {
  const cleared = { ...xOAuthCookieOptions(0), maxAge: 0 }
  response.cookies.set(X_OAUTH_COOKIE_NAMES.tokenSecret, '', cleared)
  response.cookies.set(X_OAUTH_COOKIE_NAMES.token, '', cleared)
  response.cookies.set(X_OAUTH_COOKIE_NAMES.returnTo, '', cleared)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      const r = absoluteRedirect(request, '/auth/error?error=session_required')
      clearOAuthCookies(r)
      return r
    }

    const { searchParams } = new URL(request.url)
    const oauth_token = searchParams.get('oauth_token')
    const oauth_verifier = searchParams.get('oauth_verifier')
    const denied = searchParams.get('denied')
    const returnTo = sanitizeXOAuthReturnTo(
      request.cookies.get(X_OAUTH_COOKIE_NAMES.returnTo)?.value ?? null
    )

    if (denied) {
      const r = absoluteRedirect(request, appendXOAuthError(returnTo, 'denied'))
      clearOAuthCookies(r)
      return r
    }

    const cookieSecret = request.cookies.get(X_OAUTH_COOKIE_NAMES.tokenSecret)?.value
    const cookieToken = request.cookies.get(X_OAUTH_COOKIE_NAMES.token)?.value

    if (!oauth_token || !oauth_verifier || !cookieToken || !cookieSecret) {
      const r = absoluteRedirect(request, appendXOAuthError(returnTo, 'missing_oauth_params'))
      clearOAuthCookies(r)
      return r
    }

    if (oauth_token !== cookieToken) {
      const r = absoluteRedirect(request, appendXOAuthError(returnTo, 'oauth_token_mismatch'))
      clearOAuthCookies(r)
      return r
    }

    const consumer = await getXApiConsumerKeysForOAuth(user.id)
    if (!consumer.success || !consumer.apiKey || !consumer.apiKeySecret) {
      const r = absoluteRedirect(request, appendXOAuthError(returnTo, 'no_consumer_keys'))
      clearOAuthCookies(r)
      return r
    }

    const client = new TwitterApi({
      appKey: consumer.apiKey,
      appSecret: consumer.apiKeySecret,
      accessToken: oauth_token,
      accessSecret: cookieSecret,
    })

    const { accessToken, accessSecret, screenName } = await client.login(oauth_verifier)

    const persist = await completeXApiOAuth(user.id, {
      accessToken,
      accessSecret,
      xUsername: screenName,
    })

    if (!persist.success) {
      const r = absoluteRedirect(
        request,
        appendXOAuthError(returnTo, persist.error || 'persist_failed')
      )
      clearOAuthCookies(r)
      return r
    }

    const target = returnTo.includes('?')
      ? `${returnTo}&x_connected=1`
      : `${returnTo}?x_connected=1`
    const base = resolveXOAuthAppOrigin(request)
    const response = NextResponse.redirect(new URL(target, `${base}/`).toString())
    clearOAuthCookies(response)
    return response
  } catch (error: unknown) {
    console.error('Twitter OAuth callback error:', error)
    const returnTo = sanitizeXOAuthReturnTo(
      request.cookies.get(X_OAUTH_COOKIE_NAMES.returnTo)?.value ?? null
    )
    const r = absoluteRedirect(request, appendXOAuthError(returnTo, 'callback_failed'))
    clearOAuthCookies(r)
    return r
  }
}
