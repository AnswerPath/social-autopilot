import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';
import { ContentType } from '@/lib/team-types';

/**
 * GET /api/teams/[teamId]/content
 * Get team shared content
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return withActivityLogging(async (req: NextRequest) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
          { status: 401 }
        );
      }

      const { teamId } = await params;
      
      // Check if user is a member of the team
      const hasPermission = await teamService.checkTeamPermission(teamId, user.id, 'canShareContent');
      if (!hasPermission) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INSUFFICIENT_PERMISSIONS, 'Access denied') },
          { status: 403 }
        );
      }

      // Parse content type filter
      const { searchParams } = new URL(req.url);
      const contentType = searchParams.get('type') as ContentType | null;

      const result = await teamService.getTeamSharedContent(teamId, contentType || undefined);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to get shared content') },
          { status: 500 }
        );
      }

      return NextResponse.json({ content: result.content });

    } catch (error: any) {
      console.error('Error getting team shared content:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get shared content') },
        { status: 500 }
      );
    }
  })(request);
}

/**
 * POST /api/teams/[teamId]/content
 * Share content with team
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  return withRateLimit('general')(withActivityLogging(async (req: NextRequest) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
          { status: 401 }
        );
      }

      const { teamId } = await params;
      const contentData = await req.json();

      // Validate required fields
      if (!contentData.content_type || !contentData.content_id) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Content type and content ID are required') },
          { status: 400 }
        );
      }

      // Validate content type
      if (!Object.values(ContentType).includes(contentData.content_type)) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Invalid content type') },
          { status: 400 }
        );
      }

      const result = await teamService.shareContent(teamId, user.id, contentData, req);

      if (!result.success) {
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to share content') },
          { status: 500 }
        );
      }

      return NextResponse.json({ sharing: result.sharing }, { status: 201 });

    } catch (error: any) {
      console.error('Error sharing content:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to share content') },
        { status: 500 }
      );
    }
  }))(request);
}
