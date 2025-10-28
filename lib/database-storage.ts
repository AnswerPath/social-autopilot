"use server"

import { supabaseAdmin, DatabaseCredential } from './supabase'
import { encrypt, decrypt, testEncryption } from './encryption'

export interface TwitterCredentials {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
  bearerToken?: string
}

export interface StoredCredentials extends TwitterCredentials {
  id: string
  encryptedAt: Date
  lastValidated?: Date
  isValid?: boolean
  encryptionVersion: number
}

// Test database connection with a simple query
export async function testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🔍 Testing database connection...')
    
    // First test encryption functionality
    const encryptionTest = await testEncryption()
    if (!encryptionTest.success) {
      return { 
        success: false, 
        error: `Encryption test failed: ${encryptionTest.error}` 
      }
    }
    console.log('✅ Encryption test passed')
    
    // Simple query to test if the table exists and is accessible
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .limit(1)
    
    if (error) {
      console.error('❌ Database connection test failed:', error)
      
      // Check for specific error types
      if (error.message?.includes('relation "user_credentials" does not exist') || 
          error.message?.includes('table') || 
          error.code === '42P01') {
        return { 
          success: false, 
          error: 'Database table "user_credentials" does not exist. Please run the setup script.' 
        }
      }
      
      if (error.message?.includes('permission denied') || error.code === '42501') {
        return { 
          success: false, 
          error: 'Database permission denied. Please check your Supabase service role key.' 
        }
      }
      
      return { 
        success: false, 
        error: `Database connection failed: ${error.message}` 
      }
    }
    
    console.log('✅ Database connection test passed')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Database connection error:', error)
    return { 
      success: false, 
      error: `Database connection error: ${error.message}` 
    }
  }
}

// Check if the user_credentials table exists
export async function checkTableExists(): Promise<{ exists: boolean; error?: string }> {
  try {
    // Try to query the table directly
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .limit(1)
    
    // If there's an error, check if it's a "table doesn't exist" error
    if (error) {
      if (error.message?.includes('relation "user_credentials" does not exist') || 
          error.message?.includes('table') || 
          error.code === '42P01') {
        return { 
          exists: false, 
          error: error.message 
        }
      }
      // For other errors (like permission issues), assume table exists
      console.warn('⚠️ Table check warning:', error.message)
      return { 
        exists: true, 
        error: error.message 
      }
    }
    
    // If no error, table exists (even if empty)
    return { 
      exists: true, 
      error: undefined 
    }
  } catch (error: any) {
    return { 
      exists: false, 
      error: error.message 
    }
  }
}

export async function storeTwitterCredentials(
  userId: string, 
  credentials: TwitterCredentials
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    console.log('🔐 Storing Twitter credentials for user:', userId)
    
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    // Validate input
    if (!credentials.apiKey || !credentials.apiSecret || !credentials.accessToken || !credentials.accessSecret) {
      return { success: false, error: 'All required credentials must be provided' }
    }

    console.log('🔒 Encrypting credentials...')
    
    // Encrypt all credentials
    const encryptedData = {
      user_id: userId,
      credential_type: 'twitter',
      encrypted_api_key: await encrypt(credentials.apiKey.trim()),
      encrypted_api_secret: await encrypt(credentials.apiSecret.trim()),
      encrypted_access_token: await encrypt(credentials.accessToken.trim()),
      encrypted_access_secret: await encrypt(credentials.accessSecret.trim()),
      encrypted_bearer_token: credentials.bearerToken ? await encrypt(credentials.bearerToken.trim()) : null,
      encryption_version: 1,
      is_valid: false // Will be validated separately
    }
    
    console.log('💾 Storing encrypted data in database...')
    
    // Use upsert to handle both insert and update cases
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .upsert(encryptedData, {
        onConflict: 'user_id,credential_type'
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('❌ Database error storing credentials:', error)
      return { 
        success: false, 
        error: `Failed to store credentials: ${error.message}` 
      }
    }
    
    console.log('✅ Credentials stored successfully with ID:', data.id)
    
    return { 
      success: true, 
      id: data.id 
    }
  } catch (error: any) {
    console.error('❌ Error storing credentials:', error)
    return { 
      success: false, 
      error: `Failed to securely store credentials: ${error.message}` 
    }
  }
}

export async function getTwitterCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: StoredCredentials; error?: string }> {
  try {
    console.log('🔍 Retrieving Twitter credentials for user:', userId)
    
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('credential_type', 'twitter')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { success: false, error: 'No credentials found' }
      }
      console.error('❌ Database error retrieving credentials:', error)
      return { 
        success: false, 
        error: `Failed to retrieve credentials: ${error.message}` 
      }
    }
    
    // Check if the encrypted data looks valid (basic validation)
    if (!data.encrypted_api_key || data.encrypted_api_key.length < 20) {
      console.error('❌ Invalid encrypted data detected for user:', userId)
      return { 
        success: false, 
        error: 'Invalid encrypted credentials found. Please re-add your Twitter API keys.' 
      }
    }
    
    console.log('🔓 Decrypting credentials...')
    
    // Decrypt the credentials
    try {
      const credentials: StoredCredentials = {
        id: data.id,
        apiKey: await decrypt(data.encrypted_api_key),
        apiSecret: await decrypt(data.encrypted_api_secret),
        accessToken: await decrypt(data.encrypted_access_token),
        accessSecret: await decrypt(data.encrypted_access_secret),
        bearerToken: data.encrypted_bearer_token ? await decrypt(data.encrypted_bearer_token) : undefined,
        encryptedAt: new Date(data.created_at),
        lastValidated: data.last_validated ? new Date(data.last_validated) : undefined,
        isValid: data.is_valid,
        encryptionVersion: data.encryption_version
      }
      
      console.log('✅ Credentials decrypted successfully')
      
      return { success: true, credentials }
    } catch (decryptError: any) {
      console.error('❌ Decryption error:', decryptError)
      
      // If decryption fails, the data might be corrupted or use old encryption
      return { 
        success: false, 
        error: 'Failed to decrypt credentials. The data may be corrupted. Please re-add your Twitter API keys in Settings.' 
      }
    }
  } catch (error: any) {
    console.error('❌ Error retrieving credentials:', error)
    return { 
      success: false, 
      error: `Database error: ${error.message}` 
    }
  }
}

export async function deleteTwitterCredentials(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🗑️ Deleting Twitter credentials for user:', userId)
    
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('credential_type', 'twitter')
    
    if (error) {
      console.error('❌ Database error deleting credentials:', error)
      return { 
        success: false, 
        error: `Failed to delete credentials: ${error.message}` 
      }
    }
    
    console.log('✅ Credentials deleted successfully')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Error deleting credentials:', error)
    return { 
      success: false, 
      error: `Failed to delete credentials: ${error.message}` 
    }
  }
}

export async function updateCredentialValidation(
  userId: string,
  isValid: boolean,
  lastValidated: Date = new Date()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    const { error } = await supabaseAdmin
      .from('user_credentials')
      .update({
        is_valid: isValid,
        last_validated: lastValidated.toISOString()
      })
      .eq('user_id', userId)
      .eq('credential_type', 'twitter')
    
    if (error) {
      console.error('❌ Database error updating validation:', error)
      return { 
        success: false, 
        error: `Failed to update validation: ${error.message}` 
      }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('❌ Error updating validation:', error)
    return { 
      success: false, 
      error: `Failed to update validation: ${error.message}` 
    }
  }
}

export async function getCredentialMetadata(
  userId: string
): Promise<{ success: boolean; metadata?: any; error?: string }> {
  try {
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id, is_valid, last_validated, created_at, updated_at, encryption_version')
      .eq('user_id', userId)
      .eq('credential_type', 'twitter')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'No credentials found' }
      }
      return { 
        success: false, 
        error: `Failed to retrieve metadata: ${error.message}` 
      }
    }
    
    return { 
      success: true, 
      metadata: {
        id: data.id,
        isValid: data.is_valid,
        lastValidated: data.last_validated,
        encryptedAt: data.created_at,
        updatedAt: data.updated_at,
        encryptionVersion: data.encryption_version
      }
    }
  } catch (error: any) {
    console.error('❌ Error retrieving metadata:', error)
    return { 
      success: false, 
      error: `Failed to retrieve metadata: ${error.message}` 
    }
  }
}

export async function listUserCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: any[]; error?: string }> {
  try {
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id, credential_type, is_valid, last_validated, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ Database error listing credentials:', error)
      return { 
        success: false, 
        error: `Failed to list credentials: ${error.message}` 
      }
    }
    
    return { 
      success: true, 
      credentials: data || [] 
    }
  } catch (error: any) {
    console.error('❌ Error listing credentials:', error)
    return { 
      success: false, 
      error: `Failed to list credentials: ${error.message}` 
    }
  }
}

// Utility function to check if credentials exist
export async function hasTwitterCredentials(
  userId: string
): Promise<{ success: boolean; hasCredentials: boolean; error?: string }> {
  try {
    // Test database connection first
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, hasCredentials: false, error: connectionTest.error }
    }

    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .eq('user_id', userId)
      .eq('credential_type', 'twitter')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, hasCredentials: false }
      }
      return { 
        success: false, 
        hasCredentials: false, 
        error: `Database query failed: ${error.message}` 
      }
    }
    
    return { success: true, hasCredentials: !!data }
  } catch (error: any) {
    console.error('❌ Error checking credentials:', error)
    return { 
      success: false, 
      hasCredentials: false, 
      error: `Failed to check credentials: ${error.message}` 
    }
  }
}

// Create demo credentials for testing (properly encrypted)
export async function createDemoCredentials(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🎭 Creating demo credentials...')
    
    // First check if table exists
    const tableCheck = await checkTableExists()
    if (!tableCheck.exists) {
      return {
        success: false,
        error: 'Database table does not exist. Please run the setup script.'
      }
    }

    // Delete any existing demo credentials first (simplified)
    try {
      const { error } = await supabaseAdmin
        .from('user_credentials')
        .delete()
        .eq('user_id', 'demo-user')
      
      if (error) {
        console.warn('⚠️ Cleanup warning:', error.message)
      }
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup failed:', cleanupError)
    }

    // Create properly encrypted demo credentials
    const demoCredentials = {
      apiKey: 'demo_api_key_12345',
      apiSecret: 'demo_api_secret_67890',
      accessToken: 'demo_access_token_abcde',
      accessSecret: 'demo_access_secret_fghij',
      bearerToken: 'demo_bearer_token_klmno'
    }
    
    console.log('🔒 Encrypting demo credentials...')
    
    // Encrypt all credentials
    const encryptedApiKey = await encrypt(demoCredentials.apiKey)
    const encryptedApiSecret = await encrypt(demoCredentials.apiSecret)
    const encryptedAccessToken = await encrypt(demoCredentials.accessToken)
    const encryptedAccessSecret = await encrypt(demoCredentials.accessSecret)
    const encryptedBearerToken = demoCredentials.bearerToken ? await encrypt(demoCredentials.bearerToken) : null
    
    console.log('💾 Storing encrypted credentials...')
    
    // Store in database
    const { data, error } = await supabaseAdmin
      .from('user_credentials')
      .insert({
        user_id: 'demo-user',
        credential_type: 'twitter',
        encrypted_api_key: encryptedApiKey,
        encrypted_api_secret: encryptedApiSecret,
        encrypted_access_token: encryptedAccessToken,
        encrypted_access_secret: encryptedAccessSecret,
        encrypted_bearer_token: encryptedBearerToken,
        encryption_version: 1,
        is_valid: false // Demo credentials are not valid for real use
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Failed to store demo credentials:', error)
      return { 
        success: false, 
        error: `Failed to store credentials: ${error.message}` 
      }
    }
    
    console.log('✅ Demo credentials created successfully')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Error creating demo credentials:', error)
    return { 
      success: false, 
      error: `Failed to create demo credentials: ${error.message}` 
    }
  }
}

// Get database health status
export async function getDatabaseHealth(): Promise<{
  success: boolean
  tableExists: boolean
  canRead: boolean
  canWrite: boolean
  recordCount: number
  encryptionWorking: boolean
  error?: string
}> {
  try {
    console.log('🏥 Checking database health...')
    
    // Test encryption first
    const encryptionTest = await testEncryption()
    const encryptionWorking = encryptionTest.success
    
    if (!encryptionWorking) {
      console.error('❌ Encryption test failed:', encryptionTest.error)
    }
    
    // Check if table exists
    const tableCheck = await checkTableExists()
    if (!tableCheck.exists) {
      return {
        success: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        recordCount: 0,
        encryptionWorking,
        error: 'Table does not exist'
      }
    }

    // Test read access
    let canRead = false
    let recordCount = 0
    try {
      const { data, error } = await supabaseAdmin
        .from('user_credentials')
        .select('id')
      
      if (!error) {
        canRead = true
        recordCount = data?.length || 0
      }
    } catch (readError) {
      console.error('❌ Read test failed:', readError)
    }

    // Test write access (try to insert and immediately delete a test record)
    let canWrite = false
    try {
      const testRecord = {
        user_id: 'test-user-' + Date.now(),
        credential_type: 'test',
        encrypted_api_key: await encrypt('test'),
        encrypted_api_secret: await encrypt('test'),
        encrypted_access_token: await encrypt('test'),
        encrypted_access_secret: await encrypt('test'),
        encryption_version: 1,
        is_valid: false
      }

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('user_credentials')
        .insert(testRecord)
        .select('id')
        .single()

      if (!insertError && insertData) {
        canWrite = true
        // Clean up test record
        await supabaseAdmin
          .from('user_credentials')
          .delete()
          .eq('id', insertData.id)
      }
    } catch (writeError) {
      console.error('❌ Write test failed:', writeError)
    }

    console.log('✅ Database health check completed')

    return {
      success: true,
      tableExists: true,
      canRead,
      canWrite,
      recordCount,
      encryptionWorking
    }
  } catch (error: any) {
    console.error('❌ Database health check failed:', error)
    return {
      success: false,
      tableExists: false,
      canRead: false,
      canWrite: false,
      recordCount: 0,
      encryptionWorking: false,
      error: error.message
    }
  }
}

// Clean up invalid credentials (those that can't be decrypted)
export async function cleanupInvalidCredentials(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const connectionTest = await testDatabaseConnection()
    if (!connectionTest.success) {
      return { success: false, error: connectionTest.error }
    }

    // Try to get credentials - if decryption fails, delete them
    const result = await getTwitterCredentials(userId)
    if (!result.success && result.error?.includes('decrypt')) {
      console.log('🧹 Cleaning up invalid credentials for user:', userId)
      await deleteTwitterCredentials(userId)
      return { success: true }
    }

    return { success: true }
  } catch (error: any) {
    return { 
      success: false, 
      error: `Failed to cleanup credentials: ${error.message}` 
    }
  }
}
