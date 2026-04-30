import { NextRequest, NextResponse } from 'next/server';
import { createXApiService } from '@/lib/x-api-service';
import { XApiCredentials } from '@/lib/x-api-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret, bearerToken } = body;

    const ak = typeof apiKey === 'string' ? apiKey.trim() : '';
    const aks = typeof apiKeySecret === 'string' ? apiKeySecret.trim() : '';
    const at = typeof accessToken === 'string' ? accessToken.trim() : '';
    const ats = typeof accessTokenSecret === 'string' ? accessTokenSecret.trim() : '';
    const bt =
      typeof bearerToken === 'string' && bearerToken.trim() ? bearerToken.trim() : undefined;

    if (!ak || !aks || !at || !ats) {
      return NextResponse.json(
        { error: 'Missing required fields: apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

    const testCredentials: XApiCredentials = {
      apiKey: ak,
      apiKeySecret: aks,
      accessToken: at,
      accessTokenSecret: ats,
      userId: 'test-user',
      ...(bt ? { bearerToken: bt } : {}),
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
