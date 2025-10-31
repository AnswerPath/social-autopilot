import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  getCurrentUser, 
  requireAuth, 
  createAuthError, 
  logAuditEvent 
} from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';

// Profile update schema validation
const ProfileUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
  display_name: z.string().min(1, 'Display name is required').max(100, 'Display name too long').optional(),
  bio: z.string().max(500, 'Bio too long').optional(),
  timezone: z.string().optional(),
  email_notifications: z.boolean().optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
});

/**
 * GET /api/profile
 * Get current user's profile information
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    );
  }

  try {
    // In development mode, return the mock profile from the user object
    if (user.profile) {
      return NextResponse.json({
        profile: user.profile,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        }
      });
    }

    // Get user profile from database
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch profile') },
        { status: 500 }
      );
    }

    // Return profile data (safe DTO)
    return NextResponse.json({
      profile: profile || {
        id: null,
        user_id: user.id,
        first_name: null,
        last_name: null,
        display_name: null,
        bio: null,
        avatar_url: null,
        timezone: null,
        email_notifications: true,
        created_at: null,
        updated_at: null
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to fetch profile') },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update current user's profile information
 */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    
    // Validate input data
    const validatedData = ProfileUpdateSchema.parse(body);
    
    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let result;
    
    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          ...validatedData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Profile update error:', error);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update profile') },
          { status: 500 }
        );
      }

      result = updatedProfile;
    } else {
      // Create new profile
      const { data: newProfile, error } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: user.id,
          ...validatedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Profile creation error:', error);
        return NextResponse.json(
          { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to create profile') },
          { status: 500 }
        );
      }

      result = newProfile;
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'profile_updated',
      'profile',
      result.id,
      { 
        updated_fields: Object.keys(validatedData),
        profile_id: result.id 
      },
      request
    );

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile: result
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Validation error'),
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update profile') },
      { status: 500 }
    );
  }
}
