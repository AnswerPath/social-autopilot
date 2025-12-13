/**
 * Unified credential management - consolidates Twitter and X API credentials
 * This module provides a single interface for credential management, using X API credentials
 * and automatically migrating from legacy Twitter credentials when needed.
 */

import { getXApiCredentials, storeXApiCredentials, XApiCredentials } from './x-api-storage';
import { getTwitterCredentials, storeTwitterCredentials, deleteTwitterCredentials, TwitterCredentials } from './database-storage';

export interface UnifiedCredentials extends XApiCredentials {}

/**
 * Get credentials for a user, checking X API first, then Twitter (for migration)
 */
export async function getUnifiedCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: UnifiedCredentials; error?: string; migrated?: boolean }> {
  try {
    // First, try to get X API credentials
    const xApiResult = await getXApiCredentials(userId);
    if (xApiResult.success && xApiResult.credentials) {
      return {
        success: true,
        credentials: xApiResult.credentials,
        migrated: false
      };
    }

    // If no X API credentials, check for legacy Twitter credentials
    const twitterResult = await getTwitterCredentials(userId);
    if (twitterResult.success && twitterResult.credentials) {
      console.log('🔄 Found legacy Twitter credentials, migrating to X API credentials...');
      
      // Credentials are already decrypted by getTwitterCredentials
      const { apiKey, apiSecret, accessToken, accessSecret } = twitterResult.credentials;

      // Check if any required credential field is missing
      if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        return {
          success: false,
          error: 'No valid credentials found'
        };
      }

      // Check if these are demo credentials
      if (apiKey.includes('demo_') || apiSecret.includes('demo_') ||
          accessToken.includes('demo_') || accessSecret.includes('demo_')) {
        // Don't migrate demo credentials
        return {
          success: false,
          error: 'No valid credentials found'
        };
      }

      // Migrate to X API credentials
      const xApiCredentials: XApiCredentials = {
        apiKey,
        apiKeySecret: apiSecret,
        accessToken,
        accessTokenSecret: accessSecret,
        userId
      };

      const storeResult = await storeXApiCredentials(userId, xApiCredentials);
      if (storeResult.success) {
        // Delete old Twitter credentials after successful migration
        await deleteTwitterCredentials(userId);
        console.log('✅ Successfully migrated Twitter credentials to X API credentials');
        
        return {
          success: true,
          credentials: xApiCredentials,
          migrated: true
        };
      } else {
        console.error('❌ Failed to migrate credentials:', storeResult.error);
        return {
          success: false,
          error: `Migration failed: ${storeResult.error}`
        };
      }
    }

    // No credentials found
    return {
      success: false,
      error: 'No credentials found'
    };
  } catch (error: any) {
    console.error('❌ Error getting unified credentials:', error);
    return {
      success: false,
      error: error.message || 'Failed to get credentials'
    };
  }
}

/**
 * Store credentials - always stores as X API credentials
 */
export async function storeUnifiedCredentials(
  userId: string,
  credentials: UnifiedCredentials
): Promise<{ success: boolean; error?: string; id?: string }> {
  // Delete any legacy Twitter credentials first
  try {
    await deleteTwitterCredentials(userId);
  } catch (error) {
    // Ignore errors - credentials might not exist
  }

  // Store as X API credentials
  return await storeXApiCredentials(userId, credentials);
}

/**
 * Check if user has credentials (X API or Twitter)
 */
export async function hasUnifiedCredentials(
  userId: string
): Promise<{ success: boolean; hasCredentials: boolean; error?: string }> {
  try {
    // Try to get unified credentials - if successful, user has credentials
    const result = await getUnifiedCredentials(userId);
    return {
      success: true,
      hasCredentials: result.success && !!result.credentials
    };
  } catch (error: any) {
    return {
      success: false,
      hasCredentials: false,
      error: error.message || 'Failed to check credentials'
    };
  }
}

