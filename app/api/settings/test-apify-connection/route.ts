import { NextRequest, NextResponse } from 'next/server';
import { createApifyService } from '@/lib/apify-service';
import { ApifyCredentials } from '@/lib/apify-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
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
    const testCredentials: ApifyCredentials = {
      apiKey,
      userId: 'test-user',
    };

    try {
      // Test the connection
      const apifyService = createApifyService(testCredentials);
      const testResult = await apifyService.testConnection();

      if (testResult.success) {
        // Get available actors to show what's available
        const availableActors = await apifyService.getAvailableActors();
        
        return NextResponse.json({
          success: true,
          message: 'Apify connection successful',
          availableActors: availableActors.length,
          actorCount: availableActors.length,
        });
      } else {
        return NextResponse.json(
          { error: `Connection failed: ${testResult.error}` },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('Apify connection test error:', error);
      return NextResponse.json(
        { error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error testing Apify connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
