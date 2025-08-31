import { encrypt, decrypt } from './encryption';
import { getSupabaseClient } from './build-utils';
import { ApifyCredentials } from './apify-service';

const supabase = getSupabaseClient();

export interface StoredApifyCredentials extends ApifyCredentials {
  id: string;
  created_at: string;
  updated_at: string;
  credential_type: string;
}

/**
 * Store Apify credentials securely in the database
 */
export async function storeApifyCredentials(
  userId: string,
  credentials: ApifyCredentials
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    console.log('🔐 Storing Apify credentials for user:', userId);

    // Encrypt the API key before storing
    const encryptedApiKey = await encrypt(credentials.apiKey);

    const { data, error } = await supabase
      .from('credentials')
      .upsert({
        user_id: userId,
        credential_type: 'apify',
        encrypted_credentials: JSON.stringify({
          apiKey: encryptedApiKey,
          userId: credentials.userId,
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to store Apify credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ Apify credentials stored successfully');
    return {
      success: true,
      id: data.id,
    };
  } catch (error) {
    console.error('❌ Error storing Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Retrieve Apify credentials for a user
 */
export async function getApifyCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: ApifyCredentials; error?: string }> {
  try {
    console.log('🔍 Retrieving Apify credentials for user:', userId);

    const { data, error } = await supabase
      .from('credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        return {
          success: false,
          error: 'No Apify credentials found for this user',
        };
      }
      console.error('❌ Database error retrieving Apify credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.encrypted_credentials) {
      return {
        success: false,
        error: 'Invalid encrypted credentials found. Please re-add your Apify API key.',
      };
    }

    try {
      const encryptedData = JSON.parse(data.encrypted_credentials);
      const decryptedApiKey = await decrypt(encryptedData.apiKey);

      const credentials: ApifyCredentials = {
        apiKey: decryptedApiKey,
        userId: encryptedData.userId,
      };

      console.log('✅ Apify credentials retrieved successfully');
      return {
        success: true,
        credentials,
      };
    } catch (decryptError) {
      console.error('❌ Failed to decrypt Apify credentials:', decryptError);
      return {
        success: false,
        error: 'Failed to decrypt credentials. The data may be corrupted. Please re-add your Apify API key in Settings.',
      };
    }
  } catch (error) {
    console.error('❌ Error retrieving Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete Apify credentials for a user
 */
export async function deleteApifyCredentials(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🗑️ Deleting Apify credentials for user:', userId);

    const { error } = await supabase
      .from('credentials')
      .delete()
      .eq('user_id', userId)
      .eq('credential_type', 'apify');

    if (error) {
      console.error('❌ Failed to delete Apify credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ Apify credentials deleted successfully');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error deleting Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Update Apify credentials for a user
 */
export async function updateApifyCredentials(
  userId: string,
  credentials: ApifyCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔄 Updating Apify credentials for user:', userId);

    // Encrypt the new API key
    const encryptedApiKey = await encrypt(credentials.apiKey);

    const { error } = await supabase
      .from('credentials')
      .update({
        encrypted_credentials: JSON.stringify({
          apiKey: encryptedApiKey,
          userId: credentials.userId,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('credential_type', 'apify');

    if (error) {
      console.error('❌ Failed to update Apify credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    console.log('✅ Apify credentials updated successfully');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error updating Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check if a user has Apify credentials
 */
export async function hasApifyCredentials(
  userId: string
): Promise<{ success: boolean; hasCredentials: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
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
 * Get all Apify credentials (for admin purposes)
 */
export async function getAllApifyCredentials(): Promise<{
  success: boolean;
  credentials?: StoredApifyCredentials[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('credentials')
      .select('*')
      .eq('credential_type', 'apify')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Failed to get all Apify credentials:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    return {
      success: true,
      credentials: data || [],
    };
  } catch (error) {
    console.error('❌ Error getting all Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate Apify credentials by testing the connection
 */
export async function validateApifyCredentials(
  credentials: ApifyCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    // Import here to avoid circular dependency
    const { createApifyService } = await import('./apify-service');
    const apifyService = createApifyService(credentials);
    
    const testResult = await apifyService.testConnection();
    return testResult;
  } catch (error) {
    console.error('❌ Error validating Apify credentials:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
