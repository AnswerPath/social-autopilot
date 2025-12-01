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
    
    // Check if these are real credentials (not demo)
    const isRealCredentials = !credentials.apiKey.includes('demo_') && 
      !credentials.apiSecret.includes('demo_') &&
      !credentials.accessToken.includes('demo_') &&
      !credentials.accessSecret.includes('demo_')
    
    // If switching to real credentials, clean up demo mentions
    if (isRealCredentials) {
      try {
        console.log('🧹 Cleaning up demo mentions for user:', userId)
        
        // First, check if mentions table exists by attempting a simple query
        // If the table doesn't exist, we'll catch the error and skip cleanup
        const { data: mentions, error: fetchError } = await supabaseAdmin
          .from('mentions')
          .select('id, tweet_id')
          .eq('user_id', userId)
          .limit(1) // Just check if table exists and has any data
        
        // Check for table not found errors
        if (fetchError) {
          // If table doesn't exist, that's okay - just skip cleanup
          if (fetchError.message?.includes('does not exist') || 
              fetchError.message?.includes('Could not find the table') ||
              fetchError.code === '42P01') { // PostgreSQL error code for "relation does not exist"
            console.log('ℹ️ Mentions table does not exist yet, skipping demo cleanup')
          } else {
            console.warn('⚠️ Warning: Failed to fetch mentions for cleanup:', fetchError.message)
          }
        } else if (mentions && mentions.length > 0) {
          // Table exists and has data, now fetch all mentions for cleanup
          const { data: allMentions, error: allFetchError } = await supabaseAdmin
            .from('mentions')
            .select('id, tweet_id')
            .eq('user_id', userId)
          
          if (allFetchError) {
            console.warn('⚠️ Warning: Failed to fetch all mentions for cleanup:', allFetchError.message)
          } else if (allMentions && allMentions.length > 0) {
            // Filter to only demo mentions (tweet_id starts with 'demo-')
            const demoMentionIds = allMentions
              .filter(m => m.tweet_id && m.tweet_id.startsWith('demo-'))
              .map(m => m.id)
            
            if (demoMentionIds.length > 0) {
              console.log(`🧹 Deleting ${demoMentionIds.length} demo mentions`)
              const { error: deleteError } = await supabaseAdmin
                .from('mentions')
                .delete()
                .in('id', demoMentionIds)
              
              if (deleteError) {
                console.warn('⚠️ Warning: Failed to delete demo mentions:', deleteError.message)
              } else {
                console.log(`✅ Successfully cleaned up ${demoMentionIds.length} demo mentions`)
              }
            } else {
              console.log('ℹ️ No demo mentions found to clean up')
            }
          }
        } else {
          console.log('ℹ️ No mentions found to clean up')
        }
      } catch (cleanupError: any) {
        // Handle any unexpected errors gracefully
        const errorMessage = cleanupError?.message || String(cleanupError)
        if (errorMessage.includes('does not exist') || 
            errorMessage.includes('Could not find the table') ||
            cleanupError?.code === '42P01') {
          console.log('ℹ️ Mentions table does not exist yet, skipping demo cleanup')
        } else {
          console.warn('⚠️ Warning: Error during demo mentions cleanup:', errorMessage)
        }
        // Don't fail the credential storage if cleanup fails
      }
    }
    
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
    
    // Test encryption first with timeout protection
    let encryptionWorking = false
    try {
      const encryptionTest = await Promise.race([
        testEncryption(),
        new Promise<{ success: boolean; error?: string }>((_, reject) => 
          setTimeout(() => reject(new Error('Encryption test timeout')), 5000)
        )
      ])
      encryptionWorking = encryptionTest.success
      if (!encryptionWorking) {
        console.error('❌ Encryption test failed:', encryptionTest.error)
      }
    } catch (encryptionError: any) {
      console.error('❌ Encryption test error:', encryptionError.message || encryptionError)
      // Continue with other tests even if encryption fails
    }
    
    // Check if table exists
    let tableCheck
    try {
      tableCheck = await Promise.race([
        checkTableExists(),
        new Promise<{ exists: boolean; error?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Table check timeout')), 5000)
        )
      ])
    } catch (tableError: any) {
      console.error('❌ Table check error:', tableError.message || tableError)
      return {
        success: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        recordCount: 0,
        encryptionWorking,
        error: `Table check failed: ${tableError.message || 'Unknown error'}`
      }
    }
    
    if (!tableCheck.exists) {
      return {
        success: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        recordCount: 0,
        encryptionWorking,
        error: tableCheck.error || 'Table does not exist'
      }
    }

    // Test read access with timeout
    let canRead = false
    let recordCount = 0
    try {
      const readResult = await Promise.race([
        supabaseAdmin.from('user_credentials').select('id').limit(100),
        new Promise<{ data: any; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Read test timeout')), 5000)
        )
      ])
      
      if (!readResult.error) {
        canRead = true
        recordCount = readResult.data?.length || 0
      } else {
        console.error('❌ Read test failed:', readResult.error.message)
      }
    } catch (readError: any) {
      console.error('❌ Read test error:', readError.message || readError)
      // Continue with other tests
    }

    // Test write access (try to insert and immediately delete a test record) with timeout
    let canWrite = false
    try {
      // Only test write if encryption is working
      if (encryptionWorking) {
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

        const insertResult = await Promise.race([
          supabaseAdmin.from('user_credentials').insert(testRecord).select('id').single(),
          new Promise<{ data: any; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Write test timeout')), 5000)
          )
        ])

        if (!insertResult.error && insertResult.data) {
          canWrite = true
          // Clean up test record (don't wait for this to complete)
          supabaseAdmin
            .from('user_credentials')
            .delete()
            .eq('id', insertResult.data.id)
            .then(() => console.log('✅ Test record cleaned up'))
            .catch((err) => console.warn('⚠️ Failed to clean up test record:', err))
        } else {
          console.error('❌ Write test failed:', insertResult.error?.message)
        }
      }
    } catch (writeError: any) {
      console.error('❌ Write test error:', writeError.message || writeError)
      // Continue - write test failure is not critical
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
    const errorMessage = error?.message || String(error) || 'Unknown error'
    // Don't include HTML in error messages
    const cleanError = errorMessage.includes('<html>') 
      ? 'Database connection failed - please check your Supabase configuration'
      : errorMessage
    
    return {
      success: false,
      tableExists: false,
      canRead: false,
      canWrite: false,
      recordCount: 0,
      encryptionWorking: false,
      error: cleanError
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
