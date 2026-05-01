import { NextRequest, NextResponse } from 'next/server'
import { getXOAuthCallbackUrl, resolveXOAuthAppOrigin } from '@/lib/x-oauth-config'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    appOrigin: resolveXOAuthAppOrigin(request),
    callbackUrl: getXOAuthCallbackUrl(request),
  })
}
