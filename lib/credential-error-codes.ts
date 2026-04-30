/** Structured failure reasons for credential fetch paths (avoid substring checks on user-facing messages). */
export type CredentialErrorCode =
  | 'not_found'
  | 'database_error'
  | 'oauth_pending'
  | 'invalid_encrypted'
  | 'decryption_failed'
