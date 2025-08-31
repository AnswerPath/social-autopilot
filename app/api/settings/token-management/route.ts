import { NextRequest, NextResponse } from 'next/server';
import { createTokenManagementService } from '@/lib/token-management';

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

    const tokenService = createTokenManagementService(userId);
    const status = await tokenService.getTokenStatus();

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error getting token status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, service } = body;

    if (!userId || !action || !service) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, action, and service' },
        { status: 400 }
      );
    }

    const tokenService = createTokenManagementService(userId);
    let result;

    switch (action) {
      case 'validate':
        if (service === 'apify') {
          result = await tokenService.validateApifyToken();
        } else if (service === 'x-api') {
          result = await tokenService.validateXApiToken();
        } else {
          return NextResponse.json(
            { error: 'Invalid service. Must be "apify" or "x-api"' },
            { status: 400 }
          );
        }
        break;

      case 'refresh':
        if (service === 'x-api') {
          result = await tokenService.refreshXApiToken();
        } else {
          return NextResponse.json(
            { error: 'Refresh is only available for X API' },
            { status: 400 }
          );
        }
        break;

      case 'revoke':
        if (service === 'apify') {
          result = await tokenService.revokeApifyToken();
        } else if (service === 'x-api') {
          result = await tokenService.revokeXApiToken();
        } else {
          return NextResponse.json(
            { error: 'Invalid service. Must be "apify" or "x-api"' },
            { status: 400 }
          );
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be "validate", "refresh", or "revoke"' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error performing token action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
