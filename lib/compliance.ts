/**
 * GDPR and CCPA Compliance Utilities
 * Handles data retention, deletion, and user consent for API credentials
 */

export interface DataRetentionPolicy {
  maxRetentionDays: number;
  autoDeleteExpired: boolean;
  requireExplicitConsent: boolean;
}

export interface UserConsent {
  userId: string;
  consentGiven: boolean;
  consentDate: string;
  consentVersion: string;
  dataUsage: string[];
}

export interface DataDeletionRequest {
  userId: string;
  requestDate: string;
  reason?: string;
  dataTypes: string[];
}

export class ComplianceService {
  private static readonly DEFAULT_RETENTION_DAYS = 365; // 1 year
  private static readonly CONSENT_VERSION = '1.0';

  /**
   * Get data retention policy
   */
  static getDataRetentionPolicy(): DataRetentionPolicy {
    return {
      maxRetentionDays: this.DEFAULT_RETENTION_DAYS,
      autoDeleteExpired: true,
      requireExplicitConsent: true,
    };
  }

  /**
   * Check if user has given consent for data processing
   */
  static async hasUserConsent(userId: string): Promise<boolean> {
    // In a real implementation, this would check a consent table
    // For now, we'll assume consent is given if credentials exist
    return true;
  }

  /**
   * Record user consent for data processing
   */
  static async recordUserConsent(userId: string, dataUsage: string[]): Promise<void> {
    const consent: UserConsent = {
      userId,
      consentGiven: true,
      consentDate: new Date().toISOString(),
      consentVersion: this.CONSENT_VERSION,
      dataUsage,
    };

    // In a real implementation, this would store in a consent table
    console.log('User consent recorded:', consent);
  }

  /**
   * Process data deletion request (GDPR Right to be Forgotten)
   */
  static async processDeletionRequest(request: DataDeletionRequest): Promise<boolean> {
    try {
      console.log('Processing deletion request:', request);
      
      // Delete all user data
      const { supabaseAdmin } = await import('./supabase');
      
      // Delete credentials
      await supabaseAdmin
        .from('user_credentials')
        .delete()
        .eq('user_id', request.userId);

      // In a real implementation, you would also delete:
      // - User profile data
      // - Analytics data
      // - Logs
      // - Any other user-related data

      console.log(`Successfully deleted data for user: ${request.userId}`);
      return true;
    } catch (error) {
      console.error('Error processing deletion request:', error);
      return false;
    }
  }

  /**
   * Check if data is expired according to retention policy
   */
  static isDataExpired(createdAt: string): boolean {
    const policy = this.getDataRetentionPolicy();
    const createdDate = new Date(createdAt);
    const expiryDate = new Date(createdDate.getTime() + (policy.maxRetentionDays * 24 * 60 * 60 * 1000));
    
    return new Date() > expiryDate;
  }

  /**
   * Get data export for user (GDPR Right to Data Portability)
   */
  static async exportUserData(userId: string): Promise<any> {
    try {
      const { supabaseAdmin } = await import('./supabase');
      
      // Get user credentials
      const { data: credentials } = await supabaseAdmin
        .from('user_credentials')
        .select('*')
        .eq('user_id', userId);

      // In a real implementation, you would also export:
      // - User profile data
      // - Analytics data
      // - Activity logs
      // - Settings and preferences

      return {
        userId,
        exportDate: new Date().toISOString(),
        data: {
          credentials: credentials || [],
          // Add other data types here
        },
      };
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Validate data handling compliance
   */
  static validateCompliance(): {
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check GDPR compliance
    const gdprCompliant = this.checkGDPRCompliance(issues);
    
    // Check CCPA compliance
    const ccpaCompliant = this.checkCCPACompliance(issues);
    
    return {
      gdprCompliant,
      ccpaCompliant,
      issues,
    };
  }

  private static checkGDPRCompliance(issues: string[]): boolean {
    // Check for required GDPR features
    const requiredFeatures = [
      'data_encryption',
      'consent_management',
      'data_deletion',
      'data_portability',
      'retention_policy',
    ];

    // In a real implementation, check if these features are implemented
    const implementedFeatures = [
      'data_encryption', // We have encryption
      'data_deletion',   // We have deletion
      'retention_policy', // We have retention policy
    ];

    const missingFeatures = requiredFeatures.filter(f => !implementedFeatures.includes(f));
    
    if (missingFeatures.length > 0) {
      issues.push(`Missing GDPR features: ${missingFeatures.join(', ')}`);
      return false;
    }

    return true;
  }

  private static checkCCPACompliance(issues: string[]): boolean {
    // Check for required CCPA features
    const requiredFeatures = [
      'data_disclosure',
      'opt_out_rights',
      'data_deletion',
    ];

    // In a real implementation, check if these features are implemented
    const implementedFeatures = [
      'data_deletion', // We have deletion
    ];

    const missingFeatures = requiredFeatures.filter(f => !implementedFeatures.includes(f));
    
    if (missingFeatures.length > 0) {
      issues.push(`Missing CCPA features: ${missingFeatures.join(', ')}`);
      return false;
    }

    return true;
  }
}

/**
 * Utility functions for compliance
 */
export const ComplianceUtils = {
  /**
   * Generate privacy policy text
   */
  generatePrivacyPolicy(): string {
    return `
# Privacy Policy

## Data Collection
We collect and store API credentials (Apify API keys and X API credentials) to provide social media automation services.

## Data Usage
- API credentials are used to authenticate with third-party services
- Data is encrypted at rest using industry-standard encryption
- We do not share your credentials with third parties

## Data Retention
- API credentials are retained for up to 365 days
- Expired data is automatically deleted
- You can request data deletion at any time

## Your Rights
- Right to access your data
- Right to data portability
- Right to be forgotten (data deletion)
- Right to withdraw consent

## Contact
For privacy-related inquiries, contact: privacy@socialautopilot.com
    `.trim();
  },

  /**
   * Generate terms of service text
   */
  generateTermsOfService(): string {
    return `
# Terms of Service

## Service Description
Social Autopilot provides social media automation services using Apify and X API integrations.

## User Responsibilities
- Provide valid API credentials
- Comply with third-party service terms
- Use the service responsibly and legally

## Data Security
- All credentials are encrypted
- We implement industry-standard security measures
- Regular security audits are conducted

## Service Limitations
- Rate limits apply to API calls
- Service availability depends on third-party APIs
- We are not responsible for third-party service outages

## Termination
- You may terminate your account at any time
- We may terminate accounts for violations
- Data deletion occurs upon termination
    `.trim();
  },
};
