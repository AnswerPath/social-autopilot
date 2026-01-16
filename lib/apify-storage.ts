import { encrypt, decrypt } from './encryption';
import { supabaseAdmin } from './supabase';
import { ApifyCredentials } from './apify-service';

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
    console.log('   User ID type:', typeof userId);
    console.log('   User ID length:', userId?.length);

    // Encrypt the API key before storing
    const encryptedApiKey = await encrypt(credentials.apiKey);

    // For Apify, we only need to store the API key
    // We'll use encrypted_api_key and leave other fields null
    const encryptedData = {
      user_id: userId,
      credential_type: 'apify',
      encrypted_api_key: encryptedApiKey,
      encrypted_api_secret: null, // Not used for Apify
      encrypted_access_token: null, // Not used for Apify
      encrypted_access_secret: null, // Not used for Apify
      encrypted_bearer_token: null, // Not used for Apify
      encryption_version: 1,
      is_valid: false, // Will be validated separately
    };

    // Check if there's an existing entry with x_username that we should preserve
    const { data: existing } = await supabaseAdmin
      .from('user_credentials')
      .select('x_username')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
      .single();

    // Preserve existing username if it exists
    if (existing?.x_username) {
      (encryptedData as any).x_username = existing.x_username;
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .upsert(encryptedData, {
        onConflict: 'user_id,credential_type'
      })
      .select('id')
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
    console.log('   User ID type:', typeof userId);
    console.log('   User ID length:', userId?.length);

    // Diagnostic: Check all Apify credentials in the database
    const { data: allApifyCreds } = await supabaseAdmin
      .from('user_credentials')
      .select('user_id, credential_type, created_at')
      .eq('credential_type', 'apify');
    console.log(`   Found ${allApifyCreds?.length || 0} total Apify credentials in database`);
    if (allApifyCreds && allApifyCreds.length > 0) {
      console.log('   Existing Apify credential user IDs:', allApifyCreds.map(c => c.user_id));
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        console.error(`❌ No Apify credentials found for user ID: ${userId}`);
        console.error(`   Searched for user_id="${userId}" and credential_type="apify"`);
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

    if (!data.encrypted_api_key) {
      return {
        success: false,
        error: 'Invalid encrypted credentials found. Please re-add your Apify API key.',
      };
    }

    try {
      const decryptedApiKey = await decrypt(data.encrypted_api_key);

      const credentials: ApifyCredentials = {
        apiKey: decryptedApiKey,
        userId: userId,
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
 * Store X username for a user (to avoid rate limit issues)
 */
export async function storeXUsername(
  userId: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('💾 Storing X username for user:', userId, 'username:', username);
    
    // Remove @ if present
    const cleanUsername = username.replace(/^@/, '').trim();
    
    if (!cleanUsername) {
      return {
        success: false,
        error: 'Username cannot be empty',
      };
    }

    // Update or insert the username in the user_credentials table
    // We'll store it with the apify credential type, or create a new entry
    const { data: existingCreds } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
      .single();

    if (existingCreds) {
      // Update existing Apify credentials with username
      const { error } = await supabaseAdmin
        .from('user_credentials')
        .update({ x_username: cleanUsername })
        .eq('user_id', userId)
        .eq('credential_type', 'apify');

      if (error) {
        console.error('❌ Failed to update X username:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    } else {
      // Create a minimal entry just for the username
      // We'll use null for encrypted fields since we're just storing username
      const { error } = await supabaseAdmin
        .from('user_credentials')
        .insert({
          user_id: userId,
          credential_type: 'apify',
          encrypted_api_key: '', // Placeholder - will be filled when Apify credentials are saved
          encrypted_api_secret: null,
          encrypted_access_token: null,
          encrypted_access_secret: null,
          encrypted_bearer_token: null,
          x_username: cleanUsername,
          encryption_version: 1,
          is_valid: false,
        });

      if (error) {
        console.error('❌ Failed to store X username:', error);
        return {
          success: false,
          error: `Database error: ${error.message}`,
        };
      }
    }

    console.log('✅ X username stored successfully');
    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ Error storing X username:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get stored X username for a user
 */
export async function getXUsername(
  userId: string
): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    console.log('🔍 Retrieving X username for user:', userId);

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('x_username')
      .eq('user_id', userId)
      .eq('credential_type', 'apify')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No credentials found
        return {
          success: false,
          error: 'No X username found for this user',
        };
      }
      console.error('❌ Database error retrieving X username:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!data.x_username) {
      return {
        success: false,
        error: 'No X username stored for this user',
      };
    }

    console.log('✅ X username retrieved successfully:', data.x_username);
    return {
      success: true,
      username: data.x_username,
    };
  } catch (error) {
    console.error('❌ Error retrieving X username:', error);
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

    const { error } = await supabaseAdmin
      .from('user_credentials')
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

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .update({
        encrypted_api_key: encryptedApiKey,
        encryption_version: 1,
        is_valid: false, // Will be validated separately
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
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
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
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
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
