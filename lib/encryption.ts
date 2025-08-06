// Use Web Crypto API for edge runtime compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-demo-only-change-in-production-32-chars'
const ALGORITHM = 'AES-GCM'

// Convert string to ArrayBuffer
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

// Convert ArrayBuffer to string
function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder()
  return decoder.decode(buffer)
}

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer)
  const hexCodes = [...byteArray].map(value => value.toString(16).padStart(2, '0'))
  return hexCodes.join('')
}

// Convert hex string to ArrayBuffer
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes.buffer
}

// Derive key from password using PBKDF2
async function deriveKey(password: string): Promise<CryptoKey> {
  try {
    // Ensure we have a proper 32-character key
    const keyMaterial = password.padEnd(32, '0').substring(0, 32)
    
    const importedKey = await crypto.subtle.importKey(
      'raw',
      stringToArrayBuffer(keyMaterial),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: stringToArrayBuffer('social-autopilot-salt-v1'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      importedKey,
      { name: ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    console.error('Key derivation error:', error)
    throw new Error('Failed to derive encryption key')
  }
}

export async function encrypt(text: string): Promise<string> {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input for encryption')
    }

    const key = await deriveKey(ENCRYPTION_KEY)
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 12 bytes for GCM
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      stringToArrayBuffer(text)
    )
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encrypted), iv.length)
    
    return arrayBufferToHex(combined.buffer)
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error(`Failed to encrypt data: ${error.message}`)
  }
}

export async function decrypt(encryptedData: string): Promise<string> {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data')
    }

    // Basic validation - encrypted data should be hex and reasonably long
    if (encryptedData.length < 24 || !/^[0-9a-fA-F]+$/.test(encryptedData)) {
      throw new Error('Invalid encrypted data format')
    }

    const key = await deriveKey(ENCRYPTION_KEY)
    const combined = hexToArrayBuffer(encryptedData)
    
    if (combined.byteLength < 12) {
      throw new Error('Encrypted data too short')
    }
    
    const iv = combined.slice(0, 12) // First 12 bytes are IV
    const encrypted = combined.slice(12) // Rest is encrypted data
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv
      },
      key,
      encrypted
    )
    
    return arrayBufferToString(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error(`Failed to decrypt data: ${error.message}`)
  }
}

export async function hashApiKey(apiKey: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return arrayBufferToHex(hashBuffer)
  } catch (error) {
    console.error('Hashing error:', error)
    throw new Error('Failed to hash API key')
  }
}

// Test encryption/decryption functionality
export async function testEncryption(): Promise<{ success: boolean; error?: string }> {
  try {
    const testData = 'test-encryption-data-123'
    const encrypted = await encrypt(testData)
    const decrypted = await decrypt(encrypted)
    
    if (decrypted === testData) {
      return { success: true }
    } else {
      return { success: false, error: 'Decrypted data does not match original' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
