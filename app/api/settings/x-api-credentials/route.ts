import { NextRequest, NextResponse } from 'next/server';
import {
  storeXApiCredentials,
  getXApiCredentials,
  deleteXApiCredentials,
  updateXApiCredentials,
  cleanupDemoMentions,
} from '@/lib/x-api-storage';
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
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Validate the API key format (basic validation)
    if (typeof apiKey !== 'string' || apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    const credentials: XApiCredentials = {
      apiKey,
      apiKeySecret,
      accessToken,
      accessTokenSecret,
      userId,
    };

    // Validate credentials with X API
    const validation = await validateXApiCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid X API credentials: ${validation.error}` },
        { status: 400 }
      );
    }

    // Store the validated credentials
    const storeResult = await storeXApiCredentials(userId, credentials);
    if (!storeResult.success) {
      return NextResponse.json(
        { error: storeResult.error },
        { status: 500 }
      );
    }

    // Stop any active demo monitoring and clean up demo mentions
    const monitor = activeMonitors.get(userId);
    if (monitor && monitor.type === 'demo') {
      console.log('🛑 Stopping demo monitoring after credentials configured');
      if (monitor.interval) {
        clearInterval(monitor.interval);
      }
      activeMonitors.delete(userId);
    }

    // Clean up demo mentions (this is also done in storeXApiCredentials, but we'll do it here too for immediate effect)
    console.log('🧹 [CREDENTIALS] Triggering demo mentions cleanup after storing credentials');
    const cleanupResult = await cleanupDemoMentions(userId);
    if (cleanupResult.success) {
      if (cleanupResult.deletedCount && cleanupResult.deletedCount > 0) {
        console.log(`✅ [CREDENTIALS] Cleaned up ${cleanupResult.deletedCount} demo mentions after storing credentials`);
      } else {
        console.log('ℹ️ [CREDENTIALS] No demo mentions found to clean up (may have been cleaned already)');
      }
    } else {
      console.error(`❌ [CREDENTIALS] Failed to clean up demo mentions: ${cleanupResult.error}`);
    }

    return NextResponse.json({
      success: true,
      message: 'X API credentials stored successfully',
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

    const result = await getXApiCredentials(userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    // Don't return the actual credentials in the response
    return NextResponse.json({
      success: true,
      hasCredentials: true,
      userId: result.credentials?.userId,
      // Note: API keys are not returned for security
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
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

    const userId = user.id;

    const credentials: XApiCredentials = {
      apiKey,
      apiKeySecret,
      accessToken,
      accessTokenSecret,
      userId,
    };

    // Validate the new credentials
    const validation = await validateXApiCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid X API credentials: ${validation.error}` },
        { status: 400 }
      );
    }

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
