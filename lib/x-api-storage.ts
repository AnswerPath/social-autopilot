import { encrypt, decrypt } from './encryption';
import { getSupabaseServiceRoleJwtRole, supabaseAdmin } from './supabase';
import { XApiCredentials } from './x-api-service';

/**
 * Clean up demo mentions when switching to real credentials
 * Exported so it can be called manually
 */
export async function cleanupDemoMentions(userId: string): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    console.log('🧹 [CLEANUP] Starting demo mentions cleanup for user:', userId);
    
    // First, check if mentions table exists by attempting a simple query
    const { data: mentions, error: fetchError } = await supabaseAdmin
      .from('mentions')
      .select('id, tweet_id')
      .eq('user_id', userId)
      .limit(1);
    
    // Check for table not found errors
    if (fetchError) {
      if (fetchError.message?.includes('does not exist') || 
          fetchError.message?.includes('Could not find the table') ||
          fetchError.code === '42P01') {
        console.log('ℹ️ [CLEANUP] Mentions table does not exist yet, skipping demo cleanup');
        return { success: true, deletedCount: 0 };
      }
      console.warn('⚠️ [CLEANUP] Warning: Failed to fetch mentions for cleanup:', fetchError.message);
      return { success: false, error: fetchError.message };
    }
    
    // Table exists, now fetch all mentions for cleanup
    console.log('🔍 [CLEANUP] Fetching all mentions for user:', userId);
    const { data: allMentions, error: allFetchError } = await supabaseAdmin
      .from('mentions')
      .select('id, tweet_id')
      .eq('user_id', userId);
    
    if (allFetchError) {
      console.warn('⚠️ [CLEANUP] Warning: Failed to fetch all mentions for cleanup:', allFetchError.message);
      return { success: false, error: allFetchError.message };
    }
    
    if (!allMentions || allMentions.length === 0) {
      console.log('ℹ️ [CLEANUP] No mentions found to clean up');
      return { success: true, deletedCount: 0 };
    }
    
    console.log(`📊 [CLEANUP] Found ${allMentions.length} total mentions for user ${userId}`);
    
    // Filter to only demo mentions (tweet_id starts with 'demo-' or 'demo-reply-')
    const demoMentionIds = allMentions
      .filter(m => {
        if (!m.tweet_id || typeof m.tweet_id !== 'string') {
          return false;
        }
        const isDemo = m.tweet_id.startsWith('demo-') || m.tweet_id.startsWith('demo-reply-');
        if (!isDemo) {
          // Only log first few non-demo mentions to avoid spam
          if (allMentions.indexOf(m) < 3) {
            console.log(`🔍 [CLEANUP] Non-demo mention found: tweet_id="${m.tweet_id.substring(0, 50)}${m.tweet_id.length > 50 ? '...' : ''}"`);
          }
        }
        return isDemo;
      })
      .map(m => m.id);
    
    console.log(`📊 [CLEANUP] Found ${demoMentionIds.length} demo mentions out of ${allMentions.length} total mentions`);
    
    if (demoMentionIds.length === 0 && allMentions.length > 0) {
      console.log('ℹ️ [CLEANUP] All mentions appear to be real (no demo- prefix found)');
    }
    
    if (demoMentionIds.length > 0) {
      console.log(`🧹 [CLEANUP] Deleting ${demoMentionIds.length} demo mentions with IDs:`, demoMentionIds.slice(0, 5), demoMentionIds.length > 5 ? '...' : '');
      
      // Delete in batches if there are many (Supabase has limits)
      const batchSize = 100;
      let totalDeleted = 0;
      
      for (let i = 0; i < demoMentionIds.length; i += batchSize) {
        const batch = demoMentionIds.slice(i, i + batchSize);
        const { error: deleteError, count } = await supabaseAdmin
          .from('mentions')
          .delete()
          .in('id', batch);
        
        if (deleteError) {
          console.error(`❌ [CLEANUP] Failed to delete batch ${i / batchSize + 1}:`, deleteError.message);
          return { success: false, error: deleteError.message };
        }
        
        totalDeleted += count || batch.length;
        console.log(`✅ [CLEANUP] Deleted batch ${i / batchSize + 1}: ${count || batch.length} mentions`);
      }
      
      console.log(`✅ [CLEANUP] Successfully cleaned up ${totalDeleted} demo mentions`);
      return { success: true, deletedCount: totalDeleted };
    } else {
      console.log('ℹ️ [CLEANUP] No demo mentions found to clean up (all mentions are real)');
      return { success: true, deletedCount: 0 };
    }
  } catch (cleanupError: any) {
    // Handle any unexpected errors gracefully
    const errorMessage = cleanupError?.message || String(cleanupError);
    console.error('❌ [CLEANUP] Error during demo mentions cleanup:', errorMessage);
    console.error('❌ [CLEANUP] Error stack:', cleanupError?.stack);
    
    if (errorMessage.includes('does not exist') || 
        errorMessage.includes('Could not find the table') ||
        cleanupError?.code === '42P01') {
      console.log('ℹ️ [CLEANUP] Mentions table does not exist yet, skipping demo cleanup');
      return { success: true, deletedCount: 0 };
    } else {
      console.warn('⚠️ [CLEANUP] Warning: Error during demo mentions cleanup:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}

export interface StoredXApiCredentials extends XApiCredentials {
  id: string;
  created_at: string;
  updated_at: string;
  credential_type: string;
}

/**
 * Store X API credentials securely in the database
 */
export async function storeXApiCredentials(
  userId: string,
  credentials: XApiCredentials
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    console.log('🔐 Storing X API credentials for user:', userId);

    // Encrypt all sensitive data before storing
    const encryptedApiKey = await encrypt(credentials.apiKey);
    const encryptedApiKeySecret = await encrypt(credentials.apiKeySecret);
    const encryptedAccessToken = await encrypt(credentials.accessToken);
    const encryptedAccessTokenSecret = await encrypt(credentials.accessTokenSecret);

    const encryptedData = {
      user_id: userId,
      credential_type: 'x-api',
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: encryptedApiKeySecret,
      encrypted_access_token: encryptedAccessToken,
      encrypted_access_secret: encryptedAccessTokenSecret,
      encrypted_bearer_token: null, // X API doesn't use bearer token
      encryption_version: 1,
      is_valid: false, // Will be validated separately
    };

    // #region agent log
    {
      const jwtRole = getSupabaseServiceRoleJwtRole()
      let hasClientSession = false
      try {
        const { data: sess } = await supabaseAdmin.auth.getSession()
        hasClientSession = !!sess?.session
      } catch {
        hasClientSession = false
      }
      const userIdLooksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId
      )
      fetch('http://127.0.0.1:7242/ingest/02db0ba7-e7e9-4c3a-b6c8-00220ae7f134', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '62a58b' },
        body: JSON.stringify({
          sessionId: '62a58b',
          runId: 'pre-fix',
          hypothesisId: 'H1_H2_H3',
          location: 'lib/x-api-storage.ts:storeXApiCredentials:preUpsert',
          message: 'context before user_credentials upsert',
          data: {
            jwtRole: jwtRole ?? 'missing_or_undecodable',
            hasClientSession,
            userIdLen: userId.length,
            userIdLooksUuid,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
    // #endregion

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .upsert(encryptedData, {
        onConflict: 'user_id,credential_type'
      })
      .select('id')
      .single();

    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/02db0ba7-e7e9-4c3a-b6c8-00220ae7f134', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '62a58b' },
        body: JSON.stringify({
          sessionId: '62a58b',
          runId: 'pre-fix',
          hypothesisId: 'H4_H5',
          location: 'lib/x-api-storage.ts:storeXApiCredentials:upsertError',
          message: 'user_credentials upsert failed',
          data: {
            code: error.code,
            hint: error.hint,
            rlsLikely:
              (error.message || '').toLowerCase().includes('row-level security') ||
              (error.message || '').toLowerCase().includes('rls'),
            messageSnippet: (error.message || '').slice(0, 220),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      console.error('❌ Failed to store X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ X API credentials stored successfully');
    
    // Check if these are real credentials (not demo)
    const isRealCredentials = !credentials.apiKey.includes('demo_') && 
      !credentials.apiKeySecret.includes('demo_') &&
      !credentials.accessToken.includes('demo_') &&
      !credentials.accessTokenSecret.includes('demo_');
    
    // If switching to real credentials, clean up demo mentions
    if (isRealCredentials) {
      await cleanupDemoMentions(userId);
    }
    
    return {
      success: true,
      id: data.id,
    };
  } catch (error) {
    console.error('❌ Error storing X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Retrieve X API credentials for a user
 */
export async function getXApiCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: XApiCredentials; error?: string }> {
  try {
    console.log('🔍 Retrieving X API credentials for user:', userId);

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        return {
          success: false,
          error: 'No X API credentials found for this user',
        };
      }
      console.error('❌ Database error retrieving X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.encrypted_api_key || !data.encrypted_api_secret || 
        !data.encrypted_access_token || !data.encrypted_access_secret) {
      return {
        success: false,
        error: 'Invalid encrypted credentials found. Please re-add your X API credentials.',
      };
    }

    try {
      const decryptedApiKey = await decrypt(data.encrypted_api_key);
      const decryptedApiKeySecret = await decrypt(data.encrypted_api_secret);
      const decryptedAccessToken = await decrypt(data.encrypted_access_token);
      const decryptedAccessTokenSecret = await decrypt(data.encrypted_access_secret);

      const credentials: XApiCredentials = {
        apiKey: decryptedApiKey,
        apiKeySecret: decryptedApiKeySecret,
        accessToken: decryptedAccessToken,
        accessTokenSecret: decryptedAccessTokenSecret,
        userId: userId,
      };

      console.log('✅ X API credentials retrieved successfully');
      return {
        success: true,
        credentials,
      };
    } catch (decryptError) {
      console.error('❌ Failed to decrypt X API credentials:', decryptError);
      return {
        success: false,
        error: 'Failed to decrypt credentials. The data may be corrupted. Please re-add your X API credentials in Settings.',
      };
    }
  } catch (error) {
    console.error('❌ Error retrieving X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete X API credentials for a user
 */
export async function deleteXApiCredentials(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🗑️ Deleting X API credentials for user:', userId);

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('credential_type', 'x-api');

    if (error) {
      console.error('❌ Failed to delete X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ X API credentials deleted successfully');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error deleting X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update X API credentials for a user
 */
export async function updateXApiCredentials(
  userId: string,
  credentials: XApiCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔄 Updating X API credentials for user:', userId);

    // Encrypt all sensitive data
    const encryptedApiKey = await encrypt(credentials.apiKey);
    const encryptedApiKeySecret = await encrypt(credentials.apiKeySecret);
    const encryptedAccessToken = await encrypt(credentials.accessToken);
    const encryptedAccessTokenSecret = await encrypt(credentials.accessTokenSecret);

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .update({
        encrypted_api_key: encryptedApiKey,
        encrypted_api_secret: encryptedApiKeySecret,
        encrypted_access_token: encryptedAccessToken,
        encrypted_access_secret: encryptedAccessTokenSecret,
        encryption_version: 1,
        is_valid: false, // Will be validated separately
      })
      .eq('user_id', userId)
      .eq('credential_type', 'x-api');

    if (error) {
      console.error('❌ Failed to update X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ X API credentials updated successfully');
    
    // Check if these are real credentials (not demo)
    const isRealCredentials = !credentials.apiKey.includes('demo_') && 
      !credentials.apiKeySecret.includes('demo_') &&
      !credentials.accessToken.includes('demo_') &&
      !credentials.accessTokenSecret.includes('demo_');
    
    // If switching to real credentials, clean up demo mentions
    if (isRealCredentials) {
      await cleanupDemoMentions(userId);
    }
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error updating X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check if a user has X API credentials
 */
export async function hasXApiCredentials(
  userId: string
): Promise<{ success: boolean; hasCredentials: boolean; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        return {
          success: true,
          hasCredentials: false,
        };
      }
      return {
        success: false,
        hasCredentials: false,
        error: `Database error: ${error.message}`,
      };
    }

    return {
      success: true,
      hasCredentials: !!data,
    };
  } catch (error) {
    return {
      success: false,
      hasCredentials: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate X API credentials by testing the connection
 */
export async function validateXApiCredentials(
  credentials: XApiCredentials
): Promise<{ success: boolean; error?: string; user?: any }> {
  try {
    // Import here to avoid circular dependency
    const { createXApiService } = await import('./x-api-service');
    const xApiService = createXApiService(credentials);
    
    const testResult = await xApiService.testConnection();
    return testResult;
  } catch (error) {
    console.error('❌ Error validating X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
