import { NextRequest, NextResponse } from 'next/server';
import {
  getXApiCredentialsMetadata,
  deleteXApiCredentials,
  updateXApiCredentials,
  cleanupDemoMentions,
  storeXApiConsumerCredentials,
  clearXApiAccessTokens,
} from '@/lib/x-api-storage';
import { storeUnifiedCredentials } from '@/lib/unified-credentials';
import { deleteTwitterCredentials } from '@/lib/database-storage';
import { validateXApiCredentials } from '@/lib/x-api-storage';
import { XApiCredentials } from '@/lib/x-api-service';
import { activeMonitors } from '@/app/api/mentions/stream/route';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret, bearerToken } = body;

    const ak = typeof apiKey === 'string' ? apiKey.trim() : '';
    const aks = typeof apiKeySecret === 'string' ? apiKeySecret.trim() : '';
    const at = typeof accessToken === 'string' ? accessToken.trim() : '';
    const ats = typeof accessTokenSecret === 'string' ? accessTokenSecret.trim() : '';
    const bearerKeyPresent = Object.prototype.hasOwnProperty.call(body, 'bearerToken');
    const bt =
      typeof bearerToken === 'string' && bearerToken.trim() ? bearerToken.trim() : undefined;

    if (!ak || !aks) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret' },
        { status: 400 }
      );
    }

    const hasAccessTokenValue = typeof accessToken === 'string' && accessToken.trim().length > 0;
    const hasAccessSecretValue = typeof accessTokenSecret === 'string' && accessTokenSecret.trim().length > 0;
    if (hasAccessTokenValue !== hasAccessSecretValue) {
      return NextResponse.json(
        { error: 'Missing required fields: accessToken and accessTokenSecret' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Consumer keys only → store then user completes OAuth via /api/auth/twitter
    const hasManualAccess = !!(at && ats);
    if (!hasManualAccess) {
      await deleteTwitterCredentials(userId);

      let bearerForStore: string | undefined;
      if (bearerKeyPresent) {
        bearerForStore = typeof bearerToken === 'string' ? bearerToken.trim() : '';
      }

      const storeConsumer = await storeXApiConsumerCredentials(userId, {
        apiKey: ak,
        apiKeySecret: aks,
        ...(bearerKeyPresent ? { bearerToken: bearerForStore } : {}),
      });

      if (!storeConsumer.success) {
        return NextResponse.json({ error: storeConsumer.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message:
          'Consumer keys saved. Use “Connect with X” to authorize and obtain access tokens.',
        needsOAuth: true,
        id: storeConsumer.id,
      });
    }

    const credentials: XApiCredentials = {
      apiKey: ak,
      apiKeySecret: aks,
      accessToken: at,
      accessTokenSecret: ats,
      userId,
      ...(bt ? { bearerToken: bt } : {}),
    };

    // Legacy: all four secrets — validate then store
    const validation = await validateXApiCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid X API credentials: ${validation.error}` },
        { status: 400 }
      );
    }

    const storeResult = await storeUnifiedCredentials(userId, credentials);
    if (!storeResult.success) {
      return NextResponse.json({ error: storeResult.error }, { status: 500 });
    }

    const monitor = activeMonitors.get(userId);
    if (monitor && monitor.type === 'demo') {
      console.log('🛑 Stopping demo monitoring after credentials configured');
      if (monitor.interval) {
        clearInterval(monitor.interval);
      }
      activeMonitors.delete(userId);
    }

    console.log('🧹 [CREDENTIALS] Triggering demo mentions cleanup after storing credentials');
    const cleanupResult = await cleanupDemoMentions(userId);
    if (cleanupResult.success) {
      if (cleanupResult.deletedCount && cleanupResult.deletedCount > 0) {
        console.log(
          `✅ [CREDENTIALS] Cleaned up ${cleanupResult.deletedCount} demo mentions after storing credentials`
        );
      } else {
        console.log('ℹ️ [CREDENTIALS] No demo mentions found to clean up (may have been cleaned already)');
      }
    } else {
      console.error(`❌ [CREDENTIALS] Failed to clean up demo mentions: ${cleanupResult.error}`);
    }

    return NextResponse.json({
      success: true,
      message: 'X API credentials stored successfully',
      needsOAuth: false,
      id: storeResult.id,
      user: validation.user,
      demoMentionsCleaned: cleanupResult.deletedCount || 0,
    });
  } catch (error) {
    console.error('Error storing X API credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const userId = user.id;

    const metaResult = await getXApiCredentialsMetadata(userId);
    if (!metaResult.success || !metaResult.metadata) {
      return NextResponse.json(
        { error: metaResult.error || 'Failed to read credential status' },
        { status: 500 }
      );
    }

    const m = metaResult.metadata;
    const hasCredentials = m.hasRow && (m.hasConsumerKeys || m.hasAccessTokens);

    return NextResponse.json({
      success: true,
      hasCredentials,
      hasConsumerKeys: m.hasConsumerKeys,
      hasAccessTokens: m.hasAccessTokens,
      /** True when consumer keys exist but OAuth access tokens are still missing */
      needsOAuth: m.hasConsumerKeys && !m.hasAccessTokens,
      connectedXUsername: m.connectedXUsername,
      isValid: m.isValid,
      userId,
    });
  } catch (error) {
    console.error('Error retrieving X API credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret, bearerToken } = body;

    const ak = typeof apiKey === 'string' ? apiKey.trim() : '';
    const aks = typeof apiKeySecret === 'string' ? apiKeySecret.trim() : '';
    const at = typeof accessToken === 'string' ? accessToken.trim() : '';
    const ats = typeof accessTokenSecret === 'string' ? accessTokenSecret.trim() : '';
    const bearerKeyPresent = Object.prototype.hasOwnProperty.call(body, 'bearerToken');
    const bearerVal =
      typeof bearerToken === 'string' ? bearerToken.trim() : bearerKeyPresent ? '' : undefined;

    if (!ak || !aks || !at || !ats) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

    const userId = user.id;

    const credentials: XApiCredentials = {
      apiKey: ak,
      apiKeySecret: aks,
      accessToken: at,
      accessTokenSecret: ats,
      userId,
      ...(bearerKeyPresent ? { bearerToken: bearerVal || '' } : {}),
    };

    // Validate the new credentials
    const validation = await validateXApiCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid X API credentials: ${validation.error}` },
        { status: 400 }
      );
    }

    await deleteTwitterCredentials(userId);

    // Update the credentials
    const updateResult = await updateXApiCredentials(userId, credentials);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error },
        { status: 500 }
      );
    }

    // Stop any active demo monitoring and clean up demo mentions
    const monitor = activeMonitors.get(userId);
    if (monitor && monitor.type === 'demo') {
      console.log('🛑 Stopping demo monitoring after credentials updated');
      if (monitor.interval) {
        clearInterval(monitor.interval);
      }
      activeMonitors.delete(userId);
    }

    // Clean up demo mentions
    console.log('🧹 [CREDENTIALS] Triggering demo mentions cleanup after updating credentials');
    const cleanupResult = await cleanupDemoMentions(userId);
    if (cleanupResult.success) {
      if (cleanupResult.deletedCount && cleanupResult.deletedCount > 0) {
        console.log(`✅ [CREDENTIALS] Cleaned up ${cleanupResult.deletedCount} demo mentions after updating credentials`);
      } else {
        console.log('ℹ️ [CREDENTIALS] No demo mentions found to clean up (may have been cleaned already)');
      }
    } else {
      console.error(`❌ [CREDENTIALS] Failed to clean up demo mentions: ${cleanupResult.error}`);
    }

    return NextResponse.json({
      success: true,
      message: 'X API credentials updated successfully',
      user: validation.user,
      demoMentionsCleaned: cleanupResult.deletedCount || 0,
    });
  } catch (error) {
    console.error('Error updating X API credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const userId = user.id;
    const scope = request.nextUrl.searchParams.get('scope');

    if (scope === 'access') {
      await deleteTwitterCredentials(userId);
      const partial = await clearXApiAccessTokens(userId);
      if (!partial.success) {
        return NextResponse.json({ error: partial.error }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: 'X access tokens removed. Consumer keys kept — use Connect with X again to re-authorize.',
      });
    }

    await deleteTwitterCredentials(userId);

    const result = await deleteXApiCredentials(userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'X API credentials deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting X API credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
