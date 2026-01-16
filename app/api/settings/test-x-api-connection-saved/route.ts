import { NextRequest, NextResponse } from 'next/server';
import { getXApiCredentials } from '@/lib/x-api-storage';
import { createXApiService } from '@/lib/x-api-service';

/**
 * Test X API connection using saved credentials
 * This allows testing without exposing credentials in the UI
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get saved credentials
    const credentialsResult = await getXApiCredentials(userId);
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return NextResponse.json(
        { error: 'No X API credentials found. Please save your credentials first.' },
        { status: 404 }
      );
    }

    // Test the connection
    const xApiService = createXApiService(credentialsResult.credentials);
    const testResult = await xApiService.testConnection();

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully connected to X API as @${testResult.user?.username || 'user'}`,
        user: testResult.user,
      });
    } else {
      return NextResponse.json(
        { error: `Connection failed: ${testResult.error}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error testing saved X API connection:', error);
    return NextResponse.json(
      { error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

