import { NextRequest, NextResponse } from 'next/server'
import { 
  storeTwitterCredentials, 
  getTwitterCredentials, 
  deleteTwitterCredentials, 
  updateCredentialValidation,
  getCredentialMetadata 
} from '@/lib/database-storage'
import { validateTwitterCredentials } from '@/lib/twitter-validation'

// Helper function to get user ID (in production, get from auth session)
function getUserId(request: NextRequest): string {
  // In a real app, extract from JWT token or session
  // For demo purposes, using a fixed user ID
  return 'demo-user'
}

// Get current credentials metadata
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request)
    
    const result = await getCredentialMetadata(userId)
    
    if (result.success && result.metadata) {
      // Return safe metadata without actual credentials
      return NextResponse.json({
        hasCredentials: true,
        encryptedAt: result.metadata.encryptedAt,
        lastValidated: result.metadata.lastValidated,
        isValid: result.metadata.isValid,
        encryptionVersion: result.metadata.encryptionVersion,
        // Return masked versions for display
        apiKey: '••••••••',
        accessToken: '••••••••'
      })
    } else {
      return NextResponse.json({ hasCredentials: false })
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve credentials' },
      { status: 500 }
    )
  }
}

// Store new credentials
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, apiSecret, accessToken, accessSecret, bearerToken } = body
    
    // Validate required fields
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      )
    }
    
    const userId = getUserId(request)
    
    const credentials = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      accessToken: accessToken.trim(),
      accessSecret: accessSecret.trim(),
      bearerToken: bearerToken?.trim()
    }
    
    // Validate credentials with Twitter API
    const validation = await validateTwitterCredentials(credentials)
    
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid credentials' },
        { status: 400 }
      )
    }
    
    // Store encrypted credentials in database
    const storeResult = await storeTwitterCredentials(userId, credentials)
    
    if (!storeResult.success) {
      return NextResponse.json(
        { error: storeResult.error || 'Failed to store credentials' },
        { status: 500 }
      )
    }
    
    // Update validation status
    await updateCredentialValidation(userId, true)
    
    return NextResponse.json({
      success: true,
      message: 'Credentials stored and validated successfully',
      id: storeResult.id,
      userInfo: validation.userInfo,
      permissions: validation.permissions
    })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete credentials
export async function DELETE(request: NextRequest) {
  try {
    const userId = getUserId(request)
    
    const result = await deleteTwitterCredentials(userId)
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Credentials deleted successfully' 
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to delete credentials' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
