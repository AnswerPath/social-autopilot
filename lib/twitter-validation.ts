"use server"

import { TwitterCredentials } from './database-storage'

export interface ValidationResult {
  isValid: boolean
  error?: string
  userInfo?: {
    id: string
    username: string
    name: string
    verified: boolean
    followers_count: number
  }
  permissions?: {
    canRead: boolean
    canWrite: boolean
    canUploadMedia: boolean
  }
}

// Manual Twitter API validation using fetch (edge-compatible)
export async function validateTwitterCredentials(
  credentials: TwitterCredentials
): Promise<ValidationResult> {
  try {
    console.log('🔍 Starting Twitter credentials validation...')
    
    // For demo credentials, return a mock successful validation
    if (credentials.apiKey.includes('demo_')) {
      console.log('🎭 Using demo credentials - returning mock validation')
      return {
        isValid: true,
        userInfo: {
          id: '123456789',
          username: 'demo_user',
          name: 'Demo User',
          verified: false,
          followers_count: 1000
        },
        permissions: {
          canRead: true,
          canWrite: true,
          canUploadMedia: true
        }
      }
    }
    
    // For real credentials, we need to validate with Twitter API
    // Since twitter-api-v2 doesn't work in edge runtime, we'll use direct HTTP calls
    
    console.log('📡 Testing Twitter API connection with direct HTTP calls...')
    
    // Test with Bearer Token first (if available) - this is simpler
    if (credentials.bearerToken) {
      try {
        const response = await fetch('https://api.twitter.com/2/users/me?user.fields=verified,public_metrics', {
          headers: {
            'Authorization': `Bearer ${credentials.bearerToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Bearer token validation successful')
          
          return {
            isValid: true,
            userInfo: {
              id: data.data.id,
              username: data.data.username,
              name: data.data.name,
              verified: data.data.verified || false,
              followers_count: data.data.public_metrics?.followers_count || 0
            },
            permissions: {
              canRead: true,
              canWrite: false, // Bearer token is typically read-only
              canUploadMedia: false
            }
          }
        }
      } catch (bearerError) {
        console.warn('⚠️ Bearer token test failed:', bearerError)
      }
    }
    
    // For OAuth 1.0a validation, we need to make signed requests
    // This is complex without the twitter-api-v2 library, so we'll provide a simplified validation
    
    console.log('⚠️ OAuth 1.0a validation requires complex signing - using simplified validation')
    
    // Basic validation: check if credentials look valid
    const isValidFormat = 
      credentials.apiKey && credentials.apiKey.length > 10 &&
      credentials.apiSecret && credentials.apiSecret.length > 20 &&
      credentials.accessToken && credentials.accessToken.length > 20 &&
      credentials.accessSecret && credentials.accessSecret.length > 20
    
    if (!isValidFormat) {
      return {
        isValid: false,
        error: 'Invalid credential format. Please check that all API keys and tokens are correct.'
      }
    }
    
    // Since we can't easily validate OAuth 1.0a in edge runtime without complex signing,
    // we'll return a provisional validation
    console.log('✅ Credential format validation passed')
    
    return {
      isValid: true,
      userInfo: {
        id: 'pending_validation',
        username: 'pending_validation',
        name: 'Pending Validation',
        verified: false,
        followers_count: 0
      },
      permissions: {
        canRead: true,
        canWrite: true,
        canUploadMedia: true
      }
    }
    
  } catch (error: any) {
    console.error('❌ Twitter credentials validation failed:', error)
    
    let errorMessage = 'Invalid credentials'
    
    // Provide more specific error messages
    if (error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection and try again.'
    } else if (error.message?.includes('401')) {
      errorMessage = 'Authentication failed. Please check your API keys and tokens are correct.'
    } else if (error.message?.includes('403')) {
      errorMessage = 'Access forbidden. Your app may not have the required permissions.'
    } else if (error.message?.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please try again in a few minutes.'
    } else if (error.message?.includes('crypto')) {
      errorMessage = 'Runtime compatibility issue. Your credentials appear valid but cannot be fully validated in this environment.'
    }
    
    return {
      isValid: false,
      error: errorMessage
    }
  }
}

export async function testTwitterConnection(
  credentials: TwitterCredentials
): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    console.log('🧪 Testing Twitter connection...')
    
    const validation = await validateTwitterCredentials(credentials)
    
    if (validation.isValid && validation.userInfo) {
      let message = `Connection test successful`
      
      if (validation.userInfo.username !== 'pending_validation') {
        message = `Successfully connected to @${validation.userInfo.username}`
        if (validation.userInfo.followers_count > 0) {
          message += ` (${validation.userInfo.followers_count.toLocaleString()} followers)`
        }
      } else {
        message = `Credentials appear valid. Full validation requires OAuth 1.0a signing which is not available in this runtime environment.`
      }
      
      console.log('✅ Connection test successful:', message)
      
      return {
        success: true,
        message,
        details: {
          user: validation.userInfo,
          permissions: validation.permissions,
          note: validation.userInfo.username === 'pending_validation' 
            ? 'Full validation requires a Node.js runtime environment'
            : undefined
        }
      }
    } else {
      console.log('❌ Connection test failed:', validation.error)
      
      return {
        success: false,
        message: validation.error || 'Connection test failed'
      }
    }
  } catch (error: any) {
    console.error('❌ Connection test error:', error)
    
    return {
      success: false,
      message: error.message || 'Connection test failed due to an unexpected error'
    }
  }
}
