import { NextRequest, NextResponse } from 'next/server';
import { createXApiService } from '@/lib/x-api-service';
import { XApiCredentials } from '@/lib/x-api-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

    // Basic validation
    if (typeof apiKey !== 'string' || apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Create temporary credentials for testing
    const testCredentials: XApiCredentials = {
      apiKey,
      apiKeySecret,
      accessToken,
      accessTokenSecret,
      userId: 'test-user',
    };

    try {
      // Test the connection
      const xApiService = createXApiService(testCredentials);
      const testResult = await xApiService.testConnection();

      if (testResult.success) {
        return NextResponse.json({
          success: true,
          message: 'X API connection successful',
          user: testResult.user,
        });
      } else {
        return NextResponse.json(
          { error: `Connection failed: ${testResult.error}` },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('X API connection test error:', error);
      return NextResponse.json(
        { error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error testing X API connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
