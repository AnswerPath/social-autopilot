import { NextRequest, NextResponse } from 'next/server'
import {
  deleteTwitterCredentials,
  getCredentialMetadata,
} from '@/lib/database-storage'
import { deleteXApiCredentials, getXApiCredentials, validateXApiCredentials } from '@/lib/x-api-storage'
import { hasUnifiedCredentials, storeUnifiedCredentials } from '@/lib/unified-credentials'
import { XApiCredentials } from '@/lib/x-api-service'
import { requireSessionUserId } from '@/lib/require-session-user'

/**
 * Legacy route: Settings → Twitter API tab was removed.
 * GET/POST/DELETE remain as a thin compatibility layer mapping to X API (`x-api`) storage.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    const unified = await hasUnifiedCredentials(userId)
    if (!unified.hasCredentials) {
      return NextResponse.json({ hasCredentials: false })
    }

    const legacyMeta = await getCredentialMetadata(userId)
    if (legacyMeta.success && legacyMeta.metadata) {
      return NextResponse.json({
        hasCredentials: true,
        encryptedAt: legacyMeta.metadata.encryptedAt,
        lastValidated: legacyMeta.metadata.lastValidated,
        isValid: legacyMeta.metadata.isValid,
        encryptionVersion: legacyMeta.metadata.encryptionVersion,
        apiKey: '••••••••',
        accessToken: '••••••••',
        note: 'Configure X in Settings → Integrations. This endpoint is deprecated.',
      })
    }

    const x = await getXApiCredentials(userId)
    if (x.success) {
      return NextResponse.json({
        hasCredentials: true,
        apiKey: '••••••••',
        accessToken: '••••••••',
        note: 'Configure X in Settings → Integrations. This endpoint is deprecated.',
      })
    }

    return NextResponse.json({ hasCredentials: false })
  } catch (error: unknown) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to retrieve credentials' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    const body = await request.json()
    const { apiKey, apiSecret, accessToken, accessSecret, bearerToken } = body

    const ak = typeof apiKey === 'string' ? apiKey.trim() : ''
    const aks = typeof apiSecret === 'string' ? apiSecret.trim() : ''
    const at = typeof accessToken === 'string' ? accessToken.trim() : ''
    const ats = typeof accessSecret === 'string' ? accessSecret.trim() : ''
    const bt =
      typeof bearerToken === 'string' && bearerToken.trim() ? bearerToken.trim() : undefined

    if (!ak || !aks || !at || !ats) {
      return NextResponse.json(
        { error: 'All required fields must be provided (maps to Settings → Integrations X API).' },
        { status: 400 }
      )
    }

    const credentials: XApiCredentials = {
      apiKey: ak,
      apiKeySecret: aks,
      accessToken: at,
      accessTokenSecret: ats,
      userId,
      ...(bt ? { bearerToken: bt } : {}),
    }

    const validation = await validateXApiCredentials(credentials)
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error || 'Invalid credentials' },
        { status: 400 }
      )
    }

    const storeResult = await storeUnifiedCredentials(userId, credentials)
    if (!storeResult.success) {
      return NextResponse.json(
        { error: storeResult.error || 'Failed to store credentials' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        'Credentials stored as X API (Settings → Integrations). Legacy /twitter-credentials is deprecated.',
      id: storeResult.id,
      userInfo: validation.user
        ? {
            id: validation.user.id,
            username: validation.user.username,
            name: validation.user.name,
            verified: validation.user.verified,
            followers_count: validation.user.public_metrics?.followers_count ?? 0,
          }
        : undefined,
      permissions: { canRead: true, canWrite: true, canUploadMedia: true },
    })
  } catch (error: unknown) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSessionUserId(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    await deleteTwitterCredentials(userId)
    const xDel = await deleteXApiCredentials(userId)

    if (xDel.success) {
      return NextResponse.json({
        success: true,
        message: 'X / Twitter credentials removed (x-api and legacy twitter rows).',
      })
    }
    return NextResponse.json(
      { error: xDel.error || 'Failed to delete credentials' },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
