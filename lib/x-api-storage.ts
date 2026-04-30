import { encrypt, decrypt } from './encryption';
import { supabaseAdmin } from './supabase';
import { XApiCredentials } from './x-api-service';
import type { CredentialErrorCode } from './credential-error-codes';

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

/** Non-secret status for settings UI and OAuth gating */
export interface XApiCredentialsMetadata {
  hasRow: boolean;
  hasConsumerKeys: boolean;
  hasAccessTokens: boolean;
  /** From OAuth callback (X screen name); distinct from optional manual x_username in settings */
  connectedXUsername: string | null;
  isValid: boolean;
}

/**
 * Read credential row flags without decrypting secrets (for GET settings / UI).
 */
export async function getXApiCredentialsMetadata(
  userId: string
): Promise<{ success: boolean; metadata?: XApiCredentialsMetadata; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select(
        'encrypted_api_key, encrypted_api_secret, encrypted_access_token, encrypted_access_secret, x_username, is_valid'
      )
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: true,
        metadata: {
          hasRow: false,
          hasConsumerKeys: false,
          hasAccessTokens: false,
          connectedXUsername: null,
          isValid: false,
        },
      };
    }

    return {
      success: true,
      metadata: {
        hasRow: true,
        hasConsumerKeys: !!(data.encrypted_api_key && data.encrypted_api_secret),
        hasAccessTokens: !!(data.encrypted_access_token && data.encrypted_access_secret),
        connectedXUsername: data.x_username ?? null,
        isValid: !!data.is_valid,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

/**
 * Decrypt consumer key/secret for OAuth 1.0a initiate/callback (server-only).
 */
export async function getXApiConsumerKeysForOAuth(
  userId: string
): Promise<{ success: boolean; apiKey?: string; apiKeySecret?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('encrypted_api_key, encrypted_api_secret')
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data?.encrypted_api_key || !data?.encrypted_api_secret) {
      return {
        success: false,
        error: 'Save your X API Key and API Key Secret in Settings before connecting.',
      };
    }

    const apiKey = await decrypt(data.encrypted_api_key);
    const apiKeySecret = await decrypt(data.encrypted_api_secret);
    return { success: true, apiKey, apiKeySecret };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to read consumer keys',
    };
  }
}

/**
 * Store only consumer credentials; clears access tokens so the user must complete OAuth.
 */
export async function storeXApiConsumerCredentials(
  userId: string,
  params: { apiKey: string; apiKeySecret: string; bearerToken?: string }
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const encryptedApiKey = await encrypt(params.apiKey.trim());
    const encryptedApiKeySecret = await encrypt(params.apiKeySecret.trim());

    const row: Record<string, unknown> = {
      user_id: userId,
      credential_type: 'x-api' as const,
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: encryptedApiKeySecret,
      encrypted_access_token: null as string | null,
      encrypted_access_secret: null as string | null,
      x_username: null as string | null,
      encryption_version: 1,
      is_valid: false,
    };

    if (params.bearerToken !== undefined) {
      row.encrypted_bearer_token = params.bearerToken.trim()
        ? await encrypt(params.bearerToken.trim())
        : null;
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .upsert(row, { onConflict: 'user_id,credential_type' })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to upsert X API consumer credentials:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ X API consumer credentials stored (OAuth pending)');
    return { success: true, id: data.id };
  } catch (error) {
    console.error('❌ Error storing X API consumer credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * After OAuth 1.0a callback: persist user access token/secret and X username.
 */
export async function completeXApiOAuth(
  userId: string,
  tokens: { accessToken: string; accessSecret: string; xUsername: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const encryptedAccessToken = await encrypt(tokens.accessToken);
    const encryptedAccessSecret = await encrypt(tokens.accessSecret);

    const { data: updated, error } = await supabaseAdmin
      .from('user_credentials')
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_access_secret: encryptedAccessSecret,
        x_username: tokens.xUsername,
        is_valid: true,
        last_validated: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('❌ completeXApiOAuth update failed:', error);
      return { success: false, error: error.message };
    }

    if (!updated?.id) {
      return {
        success: false,
        error:
          'No X API credential row was updated. Save your API Key and API Key Secret in Settings → Integrations, then try Connect with X again.',
      };
    }

    const isRealCredentials =
      !tokens.accessToken.includes('demo_') && !tokens.accessSecret.includes('demo_');
    if (isRealCredentials) {
      await cleanupDemoMentions(userId);
    }

    console.log('✅ X API OAuth completed for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ completeXApiOAuth error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Remove user access token/secret only (keep consumer keys and optional bearer).
 */
export async function clearXApiAccessTokens(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: updated, error } = await supabaseAdmin
      .from('user_credentials')
      .update({
        encrypted_access_token: null,
        encrypted_access_secret: null,
        x_username: null,
        is_valid: false,
        last_validated: null,
      })
      .eq('user_id', userId)
      .eq('credential_type', 'x-api')
      .select('id')
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!updated?.id) {
      return {
        success: false,
        error: 'No X API credential row was updated. Nothing to clear.',
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
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
    const encryptedBearer =
      credentials.bearerToken?.trim()
        ? await encrypt(credentials.bearerToken.trim())
        : null;

    const encryptedData = {
      user_id: userId,
      credential_type: 'x-api',
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: encryptedApiKeySecret,
      encrypted_access_token: encryptedAccessToken,
      encrypted_access_secret: encryptedAccessTokenSecret,
      encrypted_bearer_token: encryptedBearer,
      encryption_version: 1,
      is_valid: false, // Will be validated separately
    };

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .upsert(encryptedData, {
        onConflict: 'user_id,credential_type'
      })
      .select('id')
      .single();

    if (error) {
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
): Promise<{
  success: boolean
  credentials?: XApiCredentials
  error?: string
  errorCode?: CredentialErrorCode
}> {
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
          errorCode: 'not_found',
        };
      }
      console.error('❌ Database error retrieving X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
        errorCode: 'database_error',
      };
    }

    if (!data.encrypted_api_key || !data.encrypted_api_secret) {
      return {
        success: false,
        error: 'Invalid encrypted credentials found. Please re-add your X API credentials.',
        errorCode: 'invalid_encrypted',
      };
    }
    if (!data.encrypted_access_token || !data.encrypted_access_secret) {
      return {
        success: false,
        error: 'X authorization is not complete. Connect with X to finish OAuth setup.',
        errorCode: 'oauth_pending',
      };
    }

    try {
      const decryptedApiKey = await decrypt(data.encrypted_api_key);
      const decryptedApiKeySecret = await decrypt(data.encrypted_api_secret);
      const decryptedAccessToken = await decrypt(data.encrypted_access_token);
      const decryptedAccessTokenSecret = await decrypt(data.encrypted_access_secret);

      let bearerToken: string | undefined;
      if (data.encrypted_bearer_token) {
        try {
          bearerToken = await decrypt(data.encrypted_bearer_token);
        } catch {
          bearerToken = undefined;
        }
      }

      const credentials: XApiCredentials = {
        apiKey: decryptedApiKey,
        apiKeySecret: decryptedApiKeySecret,
        accessToken: decryptedAccessToken,
        accessTokenSecret: decryptedAccessTokenSecret,
        userId: userId,
        ...(bearerToken ? { bearerToken } : {}),
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
        errorCode: 'decryption_failed',
      };
    }
  } catch (error) {
    console.error('❌ Error retrieving X API credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorCode: 'database_error',
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
    const encryptedBearerUpdate =
      credentials.bearerToken !== undefined
        ? credentials.bearerToken.trim()
          ? await encrypt(credentials.bearerToken.trim())
          : null
        : undefined;

    const updatePayload: Record<string, unknown> = {
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: encryptedApiKeySecret,
      encrypted_access_token: encryptedAccessToken,
      encrypted_access_secret: encryptedAccessTokenSecret,
      encryption_version: 1,
      is_valid: false, // Will be validated separately
    };
    if (encryptedBearerUpdate !== undefined) {
      updatePayload.encrypted_bearer_token = encryptedBearerUpdate;
    }

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .update(updatePayload)
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
