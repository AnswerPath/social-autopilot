import { NextRequest, NextResponse } from 'next/server';
import { getTwitterCredentials } from '@/lib/database-storage';
import { createMentionMonitoringService } from '@/lib/mention-monitoring';
import { decrypt } from '@/lib/encryption';

// Store active monitoring services per user
const activeMonitors = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    // Check if monitoring is already active for this user
    if (activeMonitors.has(userId)) {
      return NextResponse.json(
        { success: true, message: 'Monitoring already active', status: 'running' },
        { status: 200 }
      );
    }

    // Get user credentials
    const credentialsResult = await getTwitterCredentials(userId);
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return NextResponse.json(
        { success: false, error: 'Twitter credentials not found' },
        { status: 401 }
      );
    }

    const creds = credentialsResult.credentials;
    
    // Decrypt credentials
    const apiKey = await decrypt(creds.encrypted_api_key);
    const apiSecret = await decrypt(creds.encrypted_api_secret);
    const accessToken = await decrypt(creds.encrypted_access_token);
    const accessSecret = await decrypt(creds.encrypted_access_secret);

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
      return NextResponse.json(
        { success: false, error: 'Monitoring not active' },
        { status: 404 }
      );
    }

    // Stop monitoring
    await monitor.stop();
    activeMonitors.delete(userId);

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

