import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedCredentials } from '@/lib/unified-credentials';
import { createMentionMonitoringService } from '@/lib/mention-monitoring';

// Store active monitoring services per user
export const activeMonitors = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    // FIRST: Check for real credentials BEFORE checking existing monitors
    // This ensures we don't start demo mode if credentials exist
    const credentialsResult = await getUnifiedCredentials(userId);
    
    let apiKey: string | null = null;
    let apiSecret: string | null = null;
    let accessToken: string | null = null;
    let accessSecret: string | null = null;
    let hasRealCredentials = false;
    
    if (credentialsResult.success && credentialsResult.credentials) {
      const creds = credentialsResult.credentials;
      apiKey = creds.apiKey;
      apiSecret = creds.apiKeySecret;
      accessToken = creds.accessToken;
      accessSecret = creds.accessTokenSecret;
      
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
        apiKey = null; // Force demo mode
      }
    }
    
    // Check if monitoring is already active for this user
    const existingMonitor = activeMonitors.get(userId);
    if (existingMonitor) {
      // If it's a demo monitor and we now have real credentials, stop demo and switch
      if (existingMonitor.type === 'demo' && hasRealCredentials) {
        console.log('🔄 Real credentials detected, switching from demo to real monitoring');
        
        // Stop demo interval immediately
        if (existingMonitor.interval) {
          clearInterval(existingMonitor.interval);
          console.log('🛑 Stopped demo interval');
        }
        activeMonitors.delete(userId);
        
        // Continue to start real monitoring below
      } else if (existingMonitor.type === 'demo') {
        // Still in demo mode, return existing status
        return NextResponse.json(
          { success: true, message: 'Demo monitoring already active', status: 'running', mode: 'demo' },
          { status: 200 }
        );
      } else {
        // Real monitoring already active
        return NextResponse.json(
          { success: true, message: 'Monitoring already active', status: 'running' },
          { status: 200 }
        );
      }
    }
    
    // Use demo mode ONLY if credentials are not available or invalid
    // AND we've confirmed there are no real credentials
    if (!hasRealCredentials) {
      console.log('⚠️ No valid X API credentials found, running in demo mode');
      
      // IMPORTANT: Double-check that we don't have credentials before starting demo
      // This prevents race conditions where credentials were just added
      const doubleCheck = await getUnifiedCredentials(userId);
      if (doubleCheck.success && doubleCheck.credentials) {
        const creds = doubleCheck.credentials;
        if (creds.apiKey && creds.apiKeySecret && creds.accessToken && creds.accessTokenSecret &&
            !creds.apiKey.includes('demo_') && !creds.apiKeySecret.includes('demo_') &&
            !creds.accessToken.includes('demo_') && !creds.accessTokenSecret.includes('demo_')) {
          console.log('✅ Real credentials found on double-check, switching to real monitoring');
          hasRealCredentials = true;
          apiKey = creds.apiKey;
          apiSecret = creds.apiKeySecret;
          accessToken = creds.accessToken;
          accessSecret = creds.accessTokenSecret;
        }
      }
      
      // Only start demo mode if we still don't have credentials
      if (!hasRealCredentials) {
        // Generate demo mentions periodically
        const demoInterval = setInterval(async () => {
          try {
            // Before generating demo mention, check if credentials were added
            const checkCreds = await getUnifiedCredentials(userId);
            if (checkCreds.success && checkCreds.credentials) {
              const creds = checkCreds.credentials;
              if (creds.apiKey && creds.apiKeySecret && creds.accessToken && creds.accessTokenSecret &&
                  !creds.apiKey.includes('demo_') && !creds.apiKeySecret.includes('demo_') &&
                  !creds.accessToken.includes('demo_') && !creds.accessTokenSecret.includes('demo_')) {
                // Real credentials found! Stop demo mode
                console.log('🛑 Real credentials detected during demo interval, stopping demo mode');
                clearInterval(demoInterval);
                activeMonitors.delete(userId);
                return;
              }
            }
            
            const response = await fetch(`${request.nextUrl.origin}/api/mentions/demo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
              },
              body: JSON.stringify({ count: 1 }),
            });
            const data = await response.json();
            if (data.success) {
              console.log('Demo mention generated:', data.mentions?.[0]?.text);
            }
          } catch (error) {
            console.error('Error generating demo mention:', error);
          }
        }, 30000); // Generate a demo mention every 30 seconds

        // Store demo interval
        activeMonitors.set(userId, { type: 'demo', interval: demoInterval });

        return NextResponse.json(
          { 
            success: true, 
            message: 'Demo mode monitoring started (no valid X API credentials)',
            status: 'running',
            mode: 'demo'
          },
          { status: 200 }
        );
      }
    }

    // Create monitoring service
    const monitor = createMentionMonitoringService({
      credentials: {
        apiKey,
        apiKeySecret: apiSecret,
        accessToken,
        accessTokenSecret: accessSecret,
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
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
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
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    const monitor = activeMonitors.get(userId);
    if (!monitor) {
      return NextResponse.json(
        { success: false, error: 'Monitoring not active' },
        { status: 404 }
      );
    }

    const status = monitor.getStatus();
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

