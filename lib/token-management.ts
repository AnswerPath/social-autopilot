import { encrypt, decrypt } from './encryption';
import { getSupabaseClient } from './build-utils';
import { ApifyCredentials } from './apify-service';
import { XApiCredentials } from './x-api-service';

const supabase = getSupabaseClient();

export interface TokenValidationResult {
  isValid: boolean;
  needsRefresh?: boolean;
  error?: string;
  expiresAt?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newCredentials?: any;
  error?: string;
}

export interface TokenRevocationResult {
  success: boolean;
  error?: string;
}

/**
 * Unified Token Management Service for Hybrid Integration
 * Manages both Apify API keys and X API credentials
 */
export class TokenManagementService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Validate Apify API key
   */
  async validateApifyToken(): Promise<TokenValidationResult> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('credential_type', 'apify')
        .single();

      if (error || !data) {
        return {
          isValid: false,
          error: 'No Apify credentials found',
        };
      }

      // For Apify, we validate by testing the connection
      const { ApifyService } = await import('./apify-service');
      const credentials = await this.decryptApifyCredentials(data.encrypted_credentials);
      const apifyService = new ApifyService(credentials);
      
      try {
        await apifyService.testConnection();
        return {
          isValid: true,
        };
      } catch (validationError) {
        return {
          isValid: false,
          error: `Invalid Apify API key: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate X API credentials
   */
  async validateXApiToken(): Promise<TokenValidationResult> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .eq('user_id', this.userId)
        .eq('credential_type', 'x-api')
        .single();

      if (error || !data) {
        return {
          isValid: false,
          error: 'No X API credentials found',
        };
      }

      // For X API, we validate by testing the connection
      const { XApiService } = await import('./x-api-service');
      const credentials = await this.decryptXApiCredentials(data.encrypted_credentials);
      const xApiService = new XApiService(credentials);
      
      try {
        await xApiService.testConnection();
        return {
          isValid: true,
        };
      } catch (validationError) {
        return {
          isValid: false,
          error: `Invalid X API credentials: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh X API credentials (if needed)
   * Note: X API uses OAuth 1.0a, so refresh is typically manual
   */
  async refreshXApiToken(): Promise<TokenRefreshResult> {
    try {
      // For X API, refresh typically requires user re-authentication
      // This is a placeholder for future OAuth 2.0 implementation
      return {
        success: false,
        error: 'X API token refresh requires manual re-authentication',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke Apify credentials
   */
  async revokeApifyToken(): Promise<TokenRevocationResult> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .delete()
        .eq('user_id', this.userId)
        .eq('credential_type', 'apify');

      if (error) {
        return {
          success: false,
          error: `Failed to revoke Apify credentials: ${error.message}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke X API credentials
   */
  async revokeXApiToken(): Promise<TokenRevocationResult> {
    try {
      const { data, error } = await supabase
        .from('credentials')
        .delete()
        .eq('user_id', this.userId)
        .eq('credential_type', 'x-api');

      if (error) {
        return {
          success: false,
          error: `Failed to revoke X API credentials: ${error.message}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get token status for both services
   */
  async getTokenStatus(): Promise<{
    apify: TokenValidationResult;
    xApi: TokenValidationResult;
  }> {
    const [apifyStatus, xApiStatus] = await Promise.all([
      this.validateApifyToken(),
      this.validateXApiToken(),
    ]);

    return {
      apify: apifyStatus,
      xApi: xApiStatus,
    };
  }

  /**
   * Check if user has valid credentials for posting (X API)
   */
  async canPost(): Promise<boolean> {
    const xApiStatus = await this.validateXApiToken();
    return xApiStatus.isValid;
  }

  /**
   * Check if user has valid credentials for scraping (Apify)
   */
  async canScrape(): Promise<boolean> {
    const apifyStatus = await this.validateApifyToken();
    return apifyStatus.isValid;
  }

  /**
   * Decrypt Apify credentials from stored data
   */
  private async decryptApifyCredentials(encryptedData: string): Promise<ApifyCredentials> {
    const parsed = JSON.parse(encryptedData);
    const decryptedApiKey = await decrypt(parsed.apiKey);
    
    return {
      apiKey: decryptedApiKey,
      userId: parsed.userId,
    };
  }

  /**
   * Decrypt X API credentials from stored data
   */
  private async decryptXApiCredentials(encryptedData: string): Promise<XApiCredentials> {
    const parsed = JSON.parse(encryptedData);
    const decryptedApiKey = await decrypt(parsed.apiKey);
    const decryptedApiKeySecret = await decrypt(parsed.apiKeySecret);
    const decryptedAccessToken = await decrypt(parsed.accessToken);
    const decryptedAccessTokenSecret = await decrypt(parsed.accessTokenSecret);
    
    return {
      apiKey: decryptedApiKey,
      apiKeySecret: decryptedApiKeySecret,
      accessToken: decryptedAccessToken,
      accessTokenSecret: decryptedAccessTokenSecret,
      userId: parsed.userId,
    };
  }
}

/**
 * Factory function to create a token management service
 */
export function createTokenManagementService(userId: string): TokenManagementService {
  return new TokenManagementService(userId);
}
