import { NextRequest, NextResponse } from 'next/server';
import { storeXUsername, getXUsername } from '@/lib/apify-storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username } = body;

    if (!userId || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and username' },
        { status: 400 }
      );
    }

    // Validate username format (basic validation)
    const cleanUsername = username.replace(/^@/, '').trim();
    if (!cleanUsername || cleanUsername.length < 1) {
      return NextResponse.json(
        { error: 'Invalid username format' },
        { status: 400 }
      );
    }

    const result = await storeXUsername(userId, cleanUsername);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'X username stored successfully',
    });
  } catch (error) {
    console.error('Error storing X username:', error);
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

    const result = await getXUsername(userId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, username: null },
        { status: 200 } // Return 200 even if not found, just with success: false
      );
    }

    return NextResponse.json({
      success: true,
      username: result.username,
    });
  } catch (error) {
    console.error('Error retrieving X username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

