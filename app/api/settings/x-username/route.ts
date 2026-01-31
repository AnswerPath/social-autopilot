import { NextRequest, NextResponse } from 'next/server';
import { storeXUsername, getXUsername } from '@/lib/apify-storage';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      console.warn('X username POST: unauthenticated request rejected');
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { error: 'Missing required field: username' },
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

    const result = await storeXUsername(user.id, cleanUsername);
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
    const user = await getCurrentUser(request);
    if (!user) {
      console.warn('X username GET: unauthenticated request rejected');
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
        { status: 401 }
      );
    }

    const result = await getXUsername(user.id);
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
