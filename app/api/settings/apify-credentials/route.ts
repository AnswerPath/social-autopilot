import { NextRequest, NextResponse } from 'next/server';
import {
  storeApifyCredentials,
  getApifyCredentials,
  deleteApifyCredentials,
  updateApifyCredentials,
} from '@/lib/apify-storage';
import { validateApifyCredentials } from '@/lib/apify-storage';
import { ApifyCredentials } from '@/lib/apify-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, apiKey } = body;

    if (!userId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and apiKey' },
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

    const credentials: ApifyCredentials = {
      apiKey,
      userId,
    };

    // Validate credentials with Apify API
    const validation = await validateApifyCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid Apify API key: ${validation.error}` },
        { status: 400 }
      );
    }

    // Store the validated credentials
    const storeResult = await storeApifyCredentials(userId, credentials);
    if (!storeResult.success) {
      return NextResponse.json(
        { error: storeResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Apify credentials stored successfully',
      id: storeResult.id,
    });
  } catch (error) {
    console.error('Error storing Apify credentials:', error);
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

    const result = await getApifyCredentials(userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    // Don't return the actual API key in the response
    return NextResponse.json({
      success: true,
      hasCredentials: true,
      userId: result.credentials?.userId,
      // Note: API key is not returned for security
    });
  } catch (error) {
    console.error('Error retrieving Apify credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, apiKey } = body;

    if (!userId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and apiKey' },
        { status: 400 }
      );
    }

    const credentials: ApifyCredentials = {
      apiKey,
      userId,
    };

    // Validate the new credentials
    const validation = await validateApifyCredentials(credentials);
    if (!validation.success) {
      return NextResponse.json(
        { error: `Invalid Apify API key: ${validation.error}` },
        { status: 400 }
      );
    }

    // Update the credentials
    const updateResult = await updateApifyCredentials(userId, credentials);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Apify credentials updated successfully',
    });
  } catch (error) {
    console.error('Error updating Apify credentials:', error);
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

    const result = await deleteApifyCredentials(userId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Apify credentials deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting Apify credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
