"use server"

import { encrypt, decrypt } from './encryption'

// In a real application, this would be stored in a database
// For demo purposes, we'll use a simple in-memory store
const apiKeyStore = new Map<string, {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
  bearerToken?: string
  encryptedAt: Date
  lastValidated?: Date
  isValid?: boolean
}>()

export interface TwitterCredentials {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
  bearerToken?: string
}

export interface StoredCredentials extends TwitterCredentials {
  encryptedAt: Date
  lastValidated?: Date
  isValid?: boolean
}

export async function storeTwitterCredentials(
  userId: string, 
  credentials: TwitterCredentials
): Promise<{ success: boolean; error?: string }> {
  try {
    const encryptedCredentials = {
      apiKey: await encrypt(credentials.apiKey),
      apiSecret: await encrypt(credentials.apiSecret),
      accessToken: await encrypt(credentials.accessToken),
      accessSecret: await encrypt(credentials.accessSecret),
      bearerToken: credentials.bearerToken ? await encrypt(credentials.bearerToken) : undefined,
      encryptedAt: new Date(),
      isValid: false // Will be validated separately
    }
    
    apiKeyStore.set(userId, encryptedCredentials)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error storing credentials:', error)
    return { 
      success: false, 
      error: 'Failed to securely store credentials' 
    }
  }
}

export async function getTwitterCredentials(
  userId: string
): Promise<{ success: boolean; credentials?: StoredCredentials; error?: string }> {
  try {
    const stored = apiKeyStore.get(userId)
    if (!stored) {
      return { success: false, error: 'No credentials found' }
    }
    
    const credentials: StoredCredentials = {
      apiKey: await decrypt(stored.apiKey),
      apiSecret: await decrypt(stored.apiSecret),
      accessToken: await decrypt(stored.accessToken),
      accessSecret: await decrypt(stored.accessSecret),
      bearerToken: stored.bearerToken ? await decrypt(stored.bearerToken) : undefined,
      encryptedAt: stored.encryptedAt,
      lastValidated: stored.lastValidated,
      isValid: stored.isValid
    }
    
    return { success: true, credentials }
  } catch (error: any) {
    console.error('Error retrieving credentials:', error)
    return { 
      success: false, 
      error: 'Failed to retrieve credentials' 
    }
  }
}

export async function deleteTwitterCredentials(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = apiKeyStore.delete(userId)
    return { 
      success: deleted, 
      error: deleted ? undefined : 'No credentials found to delete' 
    }
  } catch (error: any) {
    console.error('Error deleting credentials:', error)
    return { 
      success: false, 
      error: 'Failed to delete credentials' 
    }
  }
}

export async function updateCredentialValidation(
  userId: string,
  isValid: boolean,
  lastValidated: Date = new Date()
): Promise<{ success: boolean; error?: string }> {
  try {
    const stored = apiKeyStore.get(userId)
    if (!stored) {
      return { success: false, error: 'No credentials found' }
    }
    
    stored.isValid = isValid
    stored.lastValidated = lastValidated
    apiKeyStore.set(userId, stored)
    
    return { success: true }
  } catch (error: any) {
    console.error('Error updating validation:', error)
    return { 
      success: false, 
      error: 'Failed to update validation status' 
    }
  }
}
