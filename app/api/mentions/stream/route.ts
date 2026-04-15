import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedCredentials } from '@/lib/unified-credentials';
import { createMentionMonitoringService } from '@/lib/mention-monitoring';
import { XApiCredentials } from '@/lib/x-api-service';
import { isEnabled } from '@/lib/feature-flags';
import { getCurrentUser } from '@/lib/auth-utils';

/**
 * Store active monitoring services per user
 * 
 * ⚠️ SERVERLESS LIMITATION: This Map is in-memory and will NOT persist across
 * serverless cold starts (e.g., Vercel Edge, AWS Lambda). Each instance maintains
 * its own state. On cold starts, active monitors will be lost and need to be
 * restarted. This is acceptable for ephemeral monitoring but means:
 * - Monitors are per-instance, not globally shared
 * - No cross-instance coordination
 * - Users may need to restart monitoring after cold starts
 * 
 * For production with distributed monitoring, consider using:
 * - Redis/DynamoDB for shared state
 * - Database-backed monitor registration
 * - External monitoring service
 */
export const activeMonitors = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    if (!isEnabled('mention_stream_enabled')) {
      return NextResponse.json(
        { error: 'Mention stream is temporarily disabled.' },
        { status: 503 }
      );
    }
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    // FIRST: Check for real credentials BEFORE checking existing monitors
    // This ensures we don't start demo mode if credentials exist
    const credentialsResult = await getUnifiedCredentials(userId);
    
    let apiKey: string | null = null;
    let apiSecret: string | null = null;
    let accessToken: string | null = null;
    let accessSecret: string | null = null;
    let hasRealCredentials = false;
    
    if (credentialsResult.success && credentialsResult.credentials) {
      const creds = credentialsResult.credentials as XApiCredentials;
      apiKey = creds.apiKey ?? null;
      apiSecret = creds.apiKeySecret ?? null;
      accessToken = creds.accessToken ?? null;
      accessSecret = creds.accessTokenSecret ?? null;
      
      // Validate that credentials are not empty or demo placeholders
      if (apiKey && apiSecret && accessToken && accessSecret &&
          !apiKey.includes('demo_') && !apiSecret.includes('demo_') &&
          !accessToken.includes('demo_') && !accessSecret.includes('demo_')) {
        hasRealCredentials = true;
        if (credentialsResult.migrated) {
          console.log('✅ Credentials migrated from Twitter to X API format');
        }
      } else {
        console.log('⚠️ Invalid or demo credentials detected');
        apiKey = null;
      }
    }

    // Check if monitoring is already active for this user
    const existingMonitor = activeMonitors.get(userId);
    if (existingMonitor) {
      if (existingMonitor.type === 'demo') {
        if (existingMonitor.interval) {
          clearInterval(existingMonitor.interval);
          console.log('🛑 Cleared legacy demo monitor interval');
        }
        activeMonitors.delete(userId);
      } else {
        return NextResponse.json(
          { success: true, message: 'Monitoring already active', status: 'running' },
          { status: 200 }
        );
      }
    }

    if (!hasRealCredentials) {
      const doubleCheck = await getUnifiedCredentials(userId);
      if (doubleCheck.success && doubleCheck.credentials) {
        const creds = doubleCheck.credentials as XApiCredentials;
        const checkApiKey = creds.apiKey ?? null;
        const checkApiSecret = creds.apiKeySecret ?? null;
        const checkAccessToken = creds.accessToken ?? null;
        const checkAccessSecret = creds.accessTokenSecret ?? null;
        if (checkApiKey && checkApiSecret && checkAccessToken && checkAccessSecret &&
            !checkApiKey.includes('demo_') && !checkApiSecret.includes('demo_') &&
            !checkAccessToken.includes('demo_') && !checkAccessSecret.includes('demo_')) {
          console.log('✅ Real credentials found on double-check');
          hasRealCredentials = true;
          apiKey = checkApiKey;
          apiSecret = checkApiSecret;
          accessToken = checkAccessToken;
          accessSecret = checkAccessSecret;
        }
      }
    }

    if (!hasRealCredentials) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Valid X API credentials are required to start mention monitoring. Add them in Settings, then try again.',
        },
        { status: 400 }
      );
    }

    // Validate that we have all required credentials before creating monitor
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required credentials for monitoring' 
        },
        { status: 400 }
      );
    }

    // Create monitoring service
    const monitor = createMentionMonitoringService({
      credentials: {
        apiKey: apiKey as string,
        apiKeySecret: apiSecret as string,
        accessToken: accessToken as string,
        accessTokenSecret: accessSecret as string,
        userId,
      },
      userId,
      onMention: async (mention) => {
        // Mention is already stored in database by the service
        console.log('New mention received:', mention.id);
      },
      onError: (error) => {
        console.error('Mention monitoring error:', error);
      },
    });

    // Start monitoring
    await monitor.start();
    
    // Store monitor instance
    activeMonitors.set(userId, monitor);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Mention monitoring started',
        status: 'running'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error starting mention monitoring:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start monitoring' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    const monitor = activeMonitors.get(userId);
    if (!monitor) {
      // Even if monitor not found, return success (might have been cleared already)
      return NextResponse.json(
        { success: true, message: 'Monitoring already stopped' },
        { status: 200 }
      );
    }

    // Stop monitoring
    if (monitor.type === 'demo') {
      // Clear demo interval
      if (monitor.interval) {
        console.log('🛑 Clearing demo interval for user:', userId);
        clearInterval(monitor.interval);
        // Set to null to prevent any race conditions
        monitor.interval = null;
      }
    } else {
      try {
        await monitor.stop();
      } catch (stopError) {
        console.error('Error stopping real monitoring:', stopError);
        // Continue with cleanup even if stop fails
      }
    }
    
    // Remove from active monitors
    activeMonitors.delete(userId);
    console.log('✅ Monitoring stopped and removed from active monitors for user:', userId);

    return NextResponse.json(
      { success: true, message: 'Mention monitoring stopped' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error stopping mention monitoring:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to stop monitoring' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    const monitor = activeMonitors.get(userId);
    if (!monitor) {
      return NextResponse.json(
        { success: false, error: 'Monitoring not active' },
        { status: 404 }
      );
    }

    // Handle demo monitors vs real monitors
    if (monitor.type === 'demo') {
      return NextResponse.json(
        { 
          success: true, 
          status: { 
            running: true, 
            mode: 'demo',
            interval: monitor.interval ? 'active' : 'inactive'
          } 
        },
        { status: 200 }
      );
    }

    // Real monitors have getStatus() method
    const status = monitor.getStatus?.() || { running: true };
    return NextResponse.json(
      { success: true, status },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get status' 
      },
      { status: 500 }
    );
  }
}

