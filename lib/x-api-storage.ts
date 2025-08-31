import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './encryption';
import { XApiCredentials } from './x-api-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    const { data, error } = await supabase
      .from('credentials')
      .upsert({
        user_id: userId,
        credential_type: 'x-api',
        encrypted_credentials: JSON.stringify({
          apiKey: encryptedApiKey,
          apiKeySecret: encryptedApiKeySecret,
          accessToken: encryptedAccessToken,
          accessTokenSecret: encryptedAccessTokenSecret,
          userId: credentials.userId,
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to store X API credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ X API credentials stored successfully');
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

    const { data, error } = await supabase
      .from('credentials')
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

    if (!data.encrypted_credentials) {
      return {
        success: false,
        error: 'Invalid encrypted credentials found. Please re-add your X API credentials.',
      };
    }

    try {
      const encryptedData = JSON.parse(data.encrypted_credentials);
      const decryptedApiKey = await decrypt(encryptedData.apiKey);
      const decryptedApiKeySecret = await decrypt(encryptedData.apiKeySecret);
      const decryptedAccessToken = await decrypt(encryptedData.accessToken);
      const decryptedAccessTokenSecret = await decrypt(encryptedData.accessTokenSecret);

      const credentials: XApiCredentials = {
        apiKey: decryptedApiKey,
        apiKeySecret: decryptedApiKeySecret,
        accessToken: decryptedAccessToken,
        accessTokenSecret: decryptedAccessTokenSecret,
        userId: encryptedData.userId,
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

    const { error } = await supabase
      .from('credentials')
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

    const { error } = await supabase
      .from('credentials')
      .update({
        encrypted_credentials: JSON.stringify({
          apiKey: encryptedApiKey,
          apiKeySecret: encryptedApiKeySecret,
          accessToken: encryptedAccessToken,
          accessTokenSecret: encryptedAccessTokenSecret,
          userId: credentials.userId,
        }),
        updated_at: new Date().toISOString(),
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
    const { data, error } = await supabase
      .from('credentials')
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
