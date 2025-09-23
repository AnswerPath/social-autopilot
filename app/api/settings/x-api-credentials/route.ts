import { NextRequest, NextResponse } from 'next/server';
import {
  storeXApiCredentials,
  getXApiCredentials,
  deleteXApiCredentials,
  updateXApiCredentials,
} from '@/lib/x-api-storage';
import { validateXApiCredentials } from '@/lib/x-api-storage';
import { XApiCredentials } from '@/lib/x-api-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!userId || !apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, apiKey, apiKeySecret, accessToken, accessTokenSecret' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      success: true,
      message: 'X API credentials stored successfully',
      id: storeResult.id,
      user: validation.user,
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

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
    const body = await request.json();
    const { userId, apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!userId || !apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, apiKey, apiKeySecret, accessToken, accessTokenSecret' },
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

    return NextResponse.json({
      success: true,
      message: 'X API credentials updated successfully',
      user: validation.user,
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

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
