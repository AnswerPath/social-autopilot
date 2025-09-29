import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, createAuthError } from '@/lib/auth-utils';
import { AuthErrorType, Permission } from '@/lib/auth-types';
import { teamService } from '@/lib/team-service';
import { withRateLimit } from '@/lib/rate-limiting';
import { withActivityLogging } from '@/lib/activity-middleware';

/**
 * GET /api/teams
 * Get user's teams
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const industry = searchParams.get('industry');
    const size_category = searchParams.get('size_category');

    const result = await teamService.getUserTeams(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to get teams') },
        { status: 500 }
      );
    }

    // Apply client-side filtering if needed
    let teams = result.teams || [];
    
    if (search) {
      teams = teams.filter(team => 
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.description?.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (industry) {
      teams = teams.filter(team => team.industry === industry);
    }
    
    if (size_category) {
      teams = teams.filter(team => team.size_category === size_category);
    }

    return NextResponse.json({ teams });

  } catch (error: any) {
    console.error('Error getting teams:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to get teams') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    // Debug: Log cookies
    console.log('Team creation request cookies:', {
      authToken: request.cookies.get('sb-auth-token')?.value ? 'present' : 'missing',
      sessionId: request.cookies.get('sb-session-id')?.value ? 'present' : 'missing'
    });
    
    const user = await getCurrentUser(request);
    if (!user) {
      console.log('No user found in team creation request');
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_CREDENTIALS, 'Authentication required') },
        { status: 401 }
      );
    }
    
    console.log('User found for team creation:', user.email);

    const teamData = await request.json();

    // Validate required fields
    if (!teamData.name || typeof teamData.name !== 'string') {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Team name is required') },
        { status: 400 }
      );
    }

    // Validate name length
    if (teamData.name.length < 2 || teamData.name.length > 100) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.INVALID_REQUEST, 'Team name must be between 2 and 100 characters') },
        { status: 400 }
      );
    }

    const result = await teamService.createTeam(user.id, teamData, request);

    if (!result.success) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, result.error || 'Failed to create team') },
        { status: 500 }
      );
    }

    return NextResponse.json({ team: result.team }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create team') },
      { status: 500 }
    );
  }
}
