/**
 * Feature flags for gradual rollout and kill switches.
 * Reads from environment variables; optional DB/Redis overrides can be added later.
 */

import { logger } from '@/lib/logger';

export type FlagName =
  | 'analytics_sync_v2'
  | 'mention_stream_enabled'
  | 'approval_workflow_v2';

const FLAG_ENV_PREFIX = 'FEATURE_';

/**
 * Check if a feature flag is enabled.
 * @param flagName - Flag key (e.g. 'analytics_sync_v2')
 * @param context - Optional context (e.g. { userId }) for future percentage/targeting
 * @returns true if the flag is enabled
 */
export function isEnabled(
  flagName: FlagName,
  context?: { userId?: string }
): boolean {
  const envKey = `${FLAG_ENV_PREFIX}${flagName.toUpperCase()}`;
  const raw = process.env[envKey];
  const enabled = raw === 'true' || raw === '1';
  if (context?.userId && (enabled || raw)) {
    logger.debug({ flagName, userId: context.userId, enabled }, 'Feature flag evaluated');
  }
  return enabled;
}

/**
 * List of known flags and their purpose (for docs and admin UI).
 */
export const FLAG_DESCRIPTIONS: Record<FlagName, string> = {
  analytics_sync_v2: 'Use v2 analytics sync pipeline when enabled',
  mention_stream_enabled: 'Enable real-time mention stream when enabled',
  approval_workflow_v2: 'Use v2 approval workflow when enabled',
};
