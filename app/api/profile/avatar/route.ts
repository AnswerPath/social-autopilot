import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  getCurrentUser, 
  createAuthError, 
  logAuditEvent 
} from '@/lib/auth-utils';
import { AuthErrorType } from '@/lib/auth-types';

// Avatar upload request schema
const AvatarUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().refine(
    (type) => ['image/jpeg', 'image/png', 'image/webp'].includes(type),
    'Only JPEG, PNG, and WebP images are allowed'
  ),
  fileSize: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB'), // 5MB limit
});

/**
 * POST /api/profile/avatar
 * Generate presigned URL for avatar upload
 */
export async function POST(request: NextRequest) {
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
    const validatedData = AvatarUploadSchema.parse(body);
    
    // Generate unique file name
    const fileExtension = validatedData.fileType.split('/')[1];
    const fileName = `avatars/${user.id}/${Date.now()}.${fileExtension}`;
    
    // Generate presigned URL for upload
    const { data: uploadData, error } = await supabaseAdmin.storage
      .from('user-avatars')
      .createSignedUploadUrl(fileName);

    if (error) {
      console.error('Presigned URL generation error:', error);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to generate upload URL') },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'avatar_upload_initiated',
      'profile',
      user.id,
      { 
        file_name: fileName,
        file_type: validatedData.fileType,
        file_size: validatedData.fileSize 
      },
      request
    );

    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      fileName: fileName,
      token: uploadData.token
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

    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to generate upload URL') },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Delete user's avatar
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.SESSION_EXPIRED, 'Authentication required') },
      { status: 401 }
    );
  }

  try {
    // Get current profile to find avatar URL
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single();

    if (!profile?.avatar_url) {
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'No avatar to delete') },
        { status: 404 }
      );
    }

    // Extract file path from avatar URL
    const avatarUrl = new URL(profile.avatar_url);
    const filePath = avatarUrl.pathname.split('/').slice(-2).join('/'); // Get last two path segments

    // Delete file from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from('user-avatars')
      .remove([filePath]);

    if (deleteError) {
      console.error('Avatar deletion error:', deleteError);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to delete avatar') },
        { status: 500 }
      );
    }

    // Update profile to remove avatar URL
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ 
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to update profile') },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent(
      user.id,
      'avatar_deleted',
      'profile',
      user.id,
      { 
        file_path: filePath,
        previous_avatar_url: profile.avatar_url 
      },
      request
    );

    return NextResponse.json({
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Avatar deletion error:', error);
    return NextResponse.json(
      { error: createAuthError(AuthErrorType.NETWORK_ERROR, 'Failed to delete avatar') },
      { status: 500 }
    );
  }
}
